"use server";
import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAal2 } from "@/lib/auth-security";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClassLifecycleResult = {
  ok: boolean;
  message: string;
};

async function requireStaffMfa(supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!(await hasAal2(supabase))) redirect("/account?mfa=required");
}

// 10 chars from a 32-char unambiguous alphabet ~= 32^10 (~10^15) combinations.
// Stops trivial brute-forcing while still being short enough to read aloud.
function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[randomInt(chars.length)];
  return s;
}

export async function createClass(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireStaffMfa(supabase);

  // Default a 30-day expiry on new join codes; teachers can rotate
  // the code from the class page at any time.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Try a few times in case of code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = makeJoinCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({
        teacher_id: user.id,
        name,
        join_code,
        join_code_expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/teacher");
      redirect(`/teacher/classes/${data.id}`);
    }
    if (error && !error.message.includes("duplicate")) {
      throw new Error(error.message);
    }
  }
  throw new Error("Could not allocate a unique join code");
}

export async function setChapterLock(formData: FormData): Promise<void> {
  const classId = (formData.get("class_id") as string) || "";
  const chapterId = (formData.get("chapter_id") as string) || "";
  // The form sends 'locked'='1' (or omits it) for the *new* desired state.
  const locked = formData.get("locked") === "1";
  if (!classId || !chapterId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireStaffMfa(supabase);

  // The RPC enforces owner-or-admin server-side.
  await supabase.rpc("set_chapter_lock", {
    p_class: classId,
    p_chapter: chapterId,
    p_locked: locked,
  });

  revalidatePath(`/teacher/classes/${classId}`);
}

export async function rotateJoinCode(formData: FormData): Promise<void> {
  const classId = (formData.get("class_id") as string) || "";
  if (!classId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireStaffMfa(supabase);

  // RPC enforces "owner of this class or admin" on the database side;
  // we don't need a client-side role check here.
  await supabase.rpc("rotate_join_code", { p_class: classId });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/teacher");
}

export async function manageClassLifecycle(
  _prev: ClassLifecycleResult | null,
  formData: FormData
): Promise<ClassLifecycleResult> {
  const classId = String(formData.get("class_id") ?? "");
  const action = String(formData.get("lifecycle_action") ?? "").toLowerCase();
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!classId || !["archive", "restore", "delete"].includes(action)) {
    return { ok: false, message: "Invalid class action." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", user.id)
    .single();
  if (!profile || !["teacher", "admin"].includes(profile.role) || profile.disabled_at) {
    return { ok: false, message: "Staff access only." };
  }
  if (!(await hasAal2(supabase))) {
    return { ok: false, message: "Please complete MFA before managing a class." };
  }
  if (action === "delete" && profile.role !== "admin") {
    return { ok: false, message: "Only an administrator can permanently delete a class." };
  }

  // The service key never reaches the browser. The database function repeats
  // the role, ownership, confirmation, and retention checks transactionally.
  const admin = createAdminClient();
  const { error } = await admin.rpc("manage_class_lifecycle", {
    p_actor: user.id,
    p_class: classId,
    p_action: action,
    p_confirmation: confirmation,
  });

  if (error) {
    const known: Record<string, string> = {
      confirmation_mismatch: "The confirmation text does not match.",
      class_not_found: "That class could not be found.",
      class_already_archived: "This class is already archived.",
      class_not_archived: "This class is not archived.",
      restore_window_expired: "The 30-day restore window has expired.",
      retention_period_active: "The 30-day retention period is still active.",
      admin_required: "Only an administrator can permanently delete a class.",
      forbidden: "You do not have permission to manage this class.",
    };
    const key = Object.keys(known).find((candidate) =>
      error.message.includes(candidate)
    );
    return {
      ok: false,
      message: key ? known[key] : "The class could not be updated. Please try again.",
    };
  }

  revalidatePath("/teacher");
  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/admin/classes");

  const messages: Record<string, string> = {
    archive: "Class archived. Its join code is disabled and it can be restored for 30 days.",
    restore: "Class restored with a new join code.",
    delete: "Class permanently deleted. Student attempts and progress records were retained.",
  };
  return { ok: true, message: messages[action] };
}
