"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type Result = {
  ok: boolean;
  message: string;
  link?: string | null;
};

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

export async function inviteTeacher(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const { supabase, user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") {
    return { ok: false, message: "Admin access only." };
  }

  // 1. Record the invite. The RPC double-checks admin status DB-side
  // and rejects if the email is already a teacher/admin.
  const { data: inviteRow, error: rpcError } = await supabase
    .rpc("create_teacher_invite", { p_email: email })
    .single();
  if (rpcError) {
    if (rpcError.message?.includes("already_teacher")) {
      return { ok: false, message: "That account is already a teacher or admin." };
    }
    return { ok: false, message: "Could not create invite. Please try again." };
  }
  const inviteId = (inviteRow as any)?.invite_id as string | undefined;

  // 2. Generate the invite link with the admin client. Using
  // admin.generateLink(type='invite') instead of signInWithOtp:
  //   - the link tolerates email-scanner pre-fetch better,
  //   - it lands on a 'set your password' flow rather than auto-
  //     login, which is the canonical Supabase admin-invite UX,
  //   - and it doesn't rely on PKCE state living in the admin's
  //     browser cookies.
  const admin = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: origin ? `${origin}/dashboard` : undefined,
    },
  });

  if (linkError) {
    // Most likely cause: a user with this email already exists in auth.
    // Surface a useful message and leave the teacher_invites row in
    // place so a future signup still gets the promotion.
    return {
      ok: false,
      message: `Could not generate invite link: ${linkError.message}.`,
    };
  }

  // Supabase's default action_link points at /auth/v1/verify on the
  // supabase.co domain, which can't set a session cookie on our app
  // origin. We instead construct a link to our own /auth/confirm
  // route handler using the hashed_token Supabase returned. Our route
  // calls verifyOtp() server-side and sets the session cookie on
  // latin-quest.vercel.app, then redirects to ?next=.
  const hashedToken =
    (linkData as any)?.properties?.hashed_token ??
    (linkData as any)?.hashed_token ??
    null;
  const actionLink =
    hashedToken && origin
      ? `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=invite&next=/dashboard`
      : ((linkData as any)?.properties?.action_link ?? null);

  // 3. Persist the link so the UI can offer a copy fallback if the
  // teacher's email scanner kills the message before they can click.
  if (actionLink && inviteId) {
    await supabase
      .from("teacher_invites")
      .update({
        action_link: actionLink,
        action_link_sent_at: new Date().toISOString(),
      })
      .eq("id", inviteId);
  }

  revalidatePath("/admin/teachers");
  return {
    ok: true,
    message: `Invite created for ${email}. The email is on its way; if it doesn't arrive you can copy the link below.`,
    link: actionLink,
  };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  const { supabase, user, profile } = await requireAdmin();
  if (!user || profile?.role !== "admin") return;

  // If the invite already provisioned an auth user, remove that too
  // (cascades to public.profiles via the FK). Without this step,
  // re-inviting the same email later would collide on auth.users.
  const { data: invite } = await supabase
    .from("teacher_invites")
    .select("accepted_by, email")
    .eq("id", id)
    .single();

  if (invite?.accepted_by) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(invite.accepted_by);
  }

  await supabase.rpc("revoke_teacher_invite", { p_invite: id });
  revalidatePath("/admin/teachers");
}
