"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; message: string };

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
}

export async function inviteTeacher(_prev: Result | null, formData: FormData): Promise<Result> {
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const { supabase, user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") return { ok: false, message: "Admin access only." };

  // 1. Record the invite. The RPC enforces admin on the DB side too.
  const { error: rpcError } = await supabase.rpc("create_teacher_invite", { p_email: email });
  if (rpcError) {
    if (rpcError.message?.includes("already_teacher")) {
      return { ok: false, message: "That account is already a teacher or admin." };
    }
    return { ok: false, message: "Could not create invite. Please try again." };
  }

  // 2. Send the magic-link signup email. shouldCreateUser=true means the
  // teacher does not need to register first; clicking the link will create
  // their auth.users row, which fires handle_new_user, which sees the
  // pending invite and provisions the profile as 'teacher'.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: origin ? `${origin}/dashboard` : undefined,
    },
  });
  if (otpError) {
    // The invite row still exists, so the teacher can also sign in via the
    // ordinary login page and get promoted. Surface a soft warning.
    revalidatePath("/admin/teachers");
    return {
      ok: true,
      message: `Invite recorded, but the magic-link email could not be sent (${otpError.message}). The teacher can still sign up with this email and will be promoted automatically.`,
    };
  }

  revalidatePath("/admin/teachers");
  return { ok: true, message: `Invite sent to ${email}. They'll become a teacher when they click the link.` };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  const { supabase, user, profile } = await requireAdmin();
  if (!user || profile?.role !== "admin") return;
  await supabase.rpc("revoke_teacher_invite", { p_invite: id });
  revalidatePath("/admin/teachers");
}
