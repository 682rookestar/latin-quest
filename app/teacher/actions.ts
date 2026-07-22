"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// 10 chars from a 32-char unambiguous alphabet ~= 32^10 (~10^15) combinations.
// Stops trivial brute-forcing while still being short enough to read aloud.
function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function createClass(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  // RPC enforces "owner of this class or admin" on the database side;
  // we don't need a client-side role check here.
  await supabase.rpc("rotate_join_code", { p_class: classId });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/teacher");
}
