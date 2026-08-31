"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { hasAal2 } from "@/lib/auth-security";

type Result = {
  ok: boolean;
  message: string;
  link?: string | null;
};

export type TeacherAccountResult = {
  ok: boolean;
  message: string;
};

export type TeacherMfaResetResult = TeacherAccountResult;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (["teacher", "admin"].includes(profile?.role ?? "") && !(await hasAal2(supabase))) {
    return { supabase, user, profile: null };
  }
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

// 12-char unambiguous-alphabet temp password.
// Strong enough for a one-off reset; admin must DM it to the teacher
// who is expected to change it immediately via /account.
// Uses crypto.getRandomValues() for cryptographic randomness.
function generateTempPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

export async function resetTeacherPassword(
  _prev: { ok: boolean; message: string; tempPassword?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string; tempPassword?: string }> {
  const targetId = (formData.get("target_id") as string) || "";
  if (!targetId) {
    return { ok: false, message: "Missing target user id." };
  }

  const { user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") {
    return { ok: false, message: "Admin access only." };
  }
  if (targetId === user.id) {
    return {
      ok: false,
      message: "Use the Account page to change your own password.",
    };
  }

  const admin = createAdminClient();

  // Refuse to reset another admin's password from this UI -- doing
  // so should be a deliberate manual operation, not a one-click
  // button, to avoid admins accidentally locking each other out.
  const { data: targetProfile, error: profileError } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", targetId)
    .single();
  if (profileError || !targetProfile) {
    return { ok: false, message: "Could not find that user." };
  }
  if (targetProfile.role === "admin") {
    return {
      ok: false,
      message: "Admins cannot reset another admin's password from here.",
    };
  }

  const tempPassword = generateTempPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    targetId,
    { password: tempPassword }
  );
  if (updateError) {
    return {
      ok: false,
      message: `Could not reset password: ${updateError.message}`,
    };
  }

  revalidatePath("/admin/teachers");
  return {
    ok: true,
    message: `Temporary password for ${targetProfile.email}. They should change it from /account on first sign-in.`,
    tempPassword,
  };
}

const MFA_RESET_REASONS: Record<string, string> = {
  lost_device: "Lost authenticator device",
  replaced_device: "Replaced authenticator device",
  authenticator_unavailable: "Authenticator unavailable",
};

export async function resetTeacherMfa(
  _prev: TeacherMfaResetResult | null,
  formData: FormData
): Promise<TeacherMfaResetResult> {
  const targetId = String(formData.get("target_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim().toLowerCase();
  const reasonCode = String(formData.get("reason") ?? "");
  const reason = MFA_RESET_REASONS[reasonCode];

  if (!targetId || !reason) {
    return { ok: false, message: "Invalid authenticator reset request." };
  }

  const { user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") return { ok: false, message: "Admin access with MFA is required." };
  if (targetId === user.id) {
    return { ok: false, message: "You cannot reset your own authenticator from this page." };
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, email, display_name, role, disabled_at")
    .eq("id", targetId)
    .single();

  if (targetError || !target) return { ok: false, message: "Teacher account not found." };
  if (target.role !== "teacher") {
    return { ok: false, message: "Administrator authenticators cannot be reset here." };
  }
  if (target.disabled_at) {
    return { ok: false, message: "Restore this teacher account before resetting its authenticator." };
  }
  if (confirmation !== target.email.trim().toLowerCase()) {
    return { ok: false, message: "The confirmation email does not match." };
  }

  const auditEntry = {
    target_user_id: target.id,
    target_email: target.email,
    target_display_name: target.display_name,
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: "reset_mfa",
    reason,
    outcome: "pending",
  };
  const { data: audit, error: auditError } = await admin
    .from("teacher_account_audit")
    .insert(auditEntry)
    .select("id")
    .single();
  if (auditError || !audit) {
    return { ok: false, message: "Could not create the required audit record. Nothing was changed." };
  }

  const { data: factorData, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: targetId,
  });
  if (listError) {
    await admin.from("teacher_account_audit").update({ outcome: "failed" }).eq("id", audit.id);
    return { ok: false, message: `Could not check the teacher's authenticator: ${listError.message}` };
  }

  const factors = factorData?.factors ?? [];
  if (factors.length === 0) {
    await admin.from("teacher_account_audit").update({ outcome: "failed" }).eq("id", audit.id);
    return { ok: false, message: "This teacher does not have a registered authenticator to reset." };
  }

  for (const factor of factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      userId: targetId,
      id: factor.id,
    });
    if (error) {
      await admin.from("teacher_account_audit").update({ outcome: "failed" }).eq("id", audit.id);
      return {
        ok: false,
        message: "The authenticator reset was only partly completed. Contact the system administrator before asking the teacher to sign in.",
      };
    }
  }

  const { error: outcomeError } = await admin
    .from("teacher_account_audit")
    .update({ outcome: "success" })
    .eq("id", audit.id);
  if (outcomeError) {
    return {
      ok: false,
      message: "The authenticator was reset, but the audit outcome could not be updated. Contact the system administrator.",
    };
  }

  revalidatePath("/admin/teachers");
  return {
    ok: true,
    message: "Authenticator reset. The teacher has been signed out and must set up MFA again after signing in.",
  };
}

export async function manageTeacherAccount(
  _prev: TeacherAccountResult | null,
  formData: FormData
): Promise<TeacherAccountResult> {
  const targetId = String(formData.get("target_id") ?? "");
  const action = String(formData.get("account_action") ?? "").toLowerCase();
  const confirmation = String(formData.get("confirmation") ?? "").trim().toLowerCase();

  if (!targetId || !["disable", "restore", "remove"].includes(action)) {
    return { ok: false, message: "Invalid teacher account action." };
  }

  const { user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") return { ok: false, message: "Admin access only." };
  if (targetId === user.id) {
    return { ok: false, message: "You cannot manage your own account here." };
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, email, display_name, role, disabled_at")
    .eq("id", targetId)
    .single();

  if (targetError || !target) return { ok: false, message: "Teacher account not found." };
  if (target.role !== "teacher") {
    return { ok: false, message: "Administrator accounts cannot be managed here." };
  }

  const normalizedEmail = target.email.trim().toLowerCase();
  const expected = action === "remove" ? `delete ${normalizedEmail}` : normalizedEmail;
  if (confirmation !== expected) {
    return { ok: false, message: "The confirmation text does not match." };
  }

  const auditEntry = {
    target_user_id: target.id,
    target_email: target.email,
    target_display_name: target.display_name,
    actor_id: user.id,
    actor_email: user.email ?? null,
    action,
  };

  if (action === "disable") {
    if (target.disabled_at) return { ok: false, message: "This teacher is already disabled." };

    const disabledAt = new Date().toISOString();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ disabled_at: disabledAt, disabled_by: user.id })
      .eq("id", targetId)
      .eq("role", "teacher");
    if (profileError) return { ok: false, message: "Could not disable this teacher." };

    const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: "876000h",
    });
    if (banError) {
      await admin.from("profiles").update({ disabled_at: null, disabled_by: null }).eq("id", targetId);
      return { ok: false, message: `Could not disable login: ${banError.message}` };
    }

    const { error: auditError } = await admin.from("teacher_account_audit").insert(auditEntry);
    if (auditError) {
      await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      await admin.from("profiles").update({ disabled_at: null, disabled_by: null }).eq("id", targetId);
      return { ok: false, message: "The audit record failed, so the account was not disabled." };
    }
  }

  if (action === "restore") {
    if (!target.disabled_at) return { ok: false, message: "This teacher is already active." };

    const { error: unbanError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: "none",
    });
    if (unbanError) return { ok: false, message: `Could not restore login: ${unbanError.message}` };

    const { error: profileError } = await admin
      .from("profiles")
      .update({ disabled_at: null, disabled_by: null })
      .eq("id", targetId)
      .eq("role", "teacher");
    if (profileError) {
      await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      return { ok: false, message: "Could not restore this teacher." };
    }

    const { error: auditError } = await admin.from("teacher_account_audit").insert(auditEntry);
    if (auditError) {
      await admin.from("profiles").update({ disabled_at: new Date().toISOString(), disabled_by: user.id }).eq("id", targetId);
      await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      return { ok: false, message: "The audit record failed, so the account remained disabled." };
    }
  }

  if (action === "remove") {
    if (!target.disabled_at) {
      return { ok: false, message: "Disable this teacher before permanently removing them." };
    }

    const { count, error: classError } = await admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", targetId);
    if (classError) return { ok: false, message: "Could not check the teacher's classes." };
    if ((count ?? 0) > 0) {
      return { ok: false, message: "Transfer or delete all of this teacher's classes first." };
    }

    const { data: audit, error: auditError } = await admin
      .from("teacher_account_audit")
      .insert(auditEntry)
      .select("id")
      .single();
    if (auditError || !audit) return { ok: false, message: "Could not create the removal audit record." };

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId, false);
    if (deleteError) {
      await admin.from("teacher_account_audit").delete().eq("id", audit.id);
      return { ok: false, message: `Could not remove teacher: ${deleteError.message}` };
    }

    await admin.from("teacher_invites").delete().eq("email", target.email);
  }

  revalidatePath("/admin/teachers");
  revalidatePath("/admin/classes");
  revalidatePath("/admin");

  const messages: Record<string, string> = {
    disable: "Teacher disabled. Existing class and pupil access is blocked immediately.",
    restore: "Teacher access restored.",
    remove: "Teacher account permanently removed. Student records and audit history were retained.",
  };
  return { ok: true, message: messages[action] };
}

export async function transferClassOwnership(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const classId = (formData.get("class_id") as string) || "";
  const newOwnerId = (formData.get("new_owner_id") as string) || "";
  if (!classId || !newOwnerId) {
    return { ok: false, message: "Pick a new owner first." };
  }

  const { supabase, user, profile } = await requireAdmin();
  if (!user) return { ok: false, message: "You must be signed in." };
  if (profile?.role !== "admin") {
    return { ok: false, message: "Admin access only." };
  }

  const { error } = await supabase.rpc("transfer_class_ownership", {
    p_class: classId,
    p_new_owner: newOwnerId,
  });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("new_owner_not_teacher")) {
      return { ok: false, message: "New owner must be a teacher or admin." };
    }
    if (msg.includes("new_owner_not_found")) {
      return { ok: false, message: "That user no longer exists." };
    }
    if (msg.includes("class_not_found")) {
      return { ok: false, message: "Class not found." };
    }
    if (msg.includes("forbidden")) {
      return { ok: false, message: "Only admins can transfer ownership." };
    }
    return { ok: false, message: "Could not transfer ownership." };
  }

  revalidatePath("/admin/classes");
  revalidatePath("/teacher");
  return { ok: true, message: "Ownership transferred." };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  const { supabase, user, profile } = await requireAdmin();
  if (!user || profile?.role !== "admin") return;

  const { data: invite } = await supabase
    .from("teacher_invites")
    .select("accepted_by, email")
    .eq("id", id)
    .single();

  // Safety guard: once an invite has been accepted it represents an active
  // teacher account with classes, students, and progress records. Deleting
  // the auth user here would cascade-wipe all of that. Revocation is only
  // safe for invites that have never been used. Removing an established
  // teacher must be a separate, explicitly confirmed workflow.
  if (invite?.accepted_by) return;

  await supabase.rpc("revoke_teacher_invite", { p_invite: id });
  revalidatePath("/admin/teachers");
}
