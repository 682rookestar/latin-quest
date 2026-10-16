"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStudentPasswordStatus, validateNewStudentPassword } from "@/lib/student-password";
import { createPasswordVerificationClient, passwordOperationMessage, revokeStudentPasswordSessions } from "@/lib/student-password-reset";

export type StudentPasswordChangeResult = { error: string } | null;

export async function completeStudentPasswordChange(_previous: StudentPasswordChangeResult, form: FormData): Promise<StudentPasswordChangeResult> {
  const current = String(form.get("temporary_password") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm_password") ?? "");
  const validationError = validateNewStudentPassword(current, password, confirm);
  if (validationError) return { error: validationError };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) return { error: "Your sign-in has expired. Sign in with your temporary password again." };
  const { data: profile } = await supabase.from("profiles").select("role, disabled_at").eq("id", user.id).single();
  if (profile?.role !== "student" || profile.disabled_at) return { error: "An active pupil account is required." };
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2")) {
    return { error: "Verify your authenticator code before changing your password." };
  }
  const { data: statusData, error: statusError } = await supabase.rpc("student_password_status");
  const status = parseStudentPasswordStatus(statusData);
  if (statusError || !status?.session_valid || !status.required) return { error: "This reset could not be confirmed. Sign in with the latest temporary password." };
  if (status.expired) return { error: "Your temporary password has expired. Ask your teacher for a new one." };

  const admin = createAdminClient();
  const args = { p_student: user.id, p_actor: user.id, p_reset: status.reset_id };
  const { error: reserveError } = await admin.rpc("begin_student_password_operation", { ...args, p_operation: "verify" });
  if (reserveError) return { error: passwordOperationMessage(reserveError.message) };

  // Verify the current password in an isolated client, not by replacing the
  // browser's session. The pupil id comes from getUser(), never from form data.
  const verifier = createPasswordVerificationClient();
  const { data: verification, error: verificationError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
  if (verificationError || verification.user?.id !== user.id) return { error: "That temporary password is not correct. Use the latest one from your teacher." };
  await verifier.auth.signOut({ scope: "local" });

  const { data: operation, error: beginError } = await admin.rpc("begin_student_password_operation", { ...args, p_operation: "complete" });
  if (beginError || !operation?.operation_id) return { error: passwordOperationMessage(beginError?.message ?? "") };
  try {
    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (passwordError) {
      await admin.rpc("finish_student_password_operation", { p_student: user.id, p_operation_id: operation.operation_id, p_success: false });
      return { error: passwordError.code === "weak_password" || passwordError.code === "same_password"
        ? passwordError.message : "Your new password could not be saved. Please try again." };
    }
    await revokeStudentPasswordSessions(admin, user.id, user.email, password);
    const { error: finishError } = await admin.rpc("finish_student_password_operation", {
      p_student: user.id, p_operation_id: operation.operation_id, p_success: true,
    });
    if (finishError) throw new Error("password_change_incomplete");
  } catch {
    await admin.rpc("finish_student_password_operation", {
      p_student: user.id, p_operation_id: operation.operation_id, p_success: false,
    });
    return { error: "The password change could not be confirmed. Try signing in again. If neither password works, ask your teacher for a new temporary password." };
  }
  // Only a new session created after the completed reset may access learning.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (signInError) redirect("/login?password=changed");
  const { data: newAssurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (newAssurance?.nextLevel === "aal2" && newAssurance.currentLevel !== "aal2") redirect("/mfa/verify");
  revalidatePath("/account");
  revalidatePath("/learn");
  redirect("/learn?password=changed");
}
