import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateTemporaryPassword } from "./temporary-password";
import type { TemporaryPasswordResult } from "./student-password";

export function createPasswordVerificationClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function passwordOperationMessage(message: string): string {
  if (message.includes("rate_limited")) return "Too many password reset attempts. Please wait 15 minutes and try again.";
  if (message.includes("busy")) return "A password change is already in progress. Please wait two minutes and try again.";
  if (message.includes("expired")) return "Your temporary password has expired. Ask your teacher for a new one.";
  if (message.includes("changed")) return "This password reset has changed. Use the latest temporary password or ask your teacher for a new one.";
  return "The password reset could not be completed. Please try again, or ask your teacher for a new temporary password.";
}

/** Obtain a short-lived pupil JWT using the new credential solely to revoke all
 * sessions through the supported Auth admin API. Tokens never leave the server. */
export async function revokeStudentPasswordSessions(admin: SupabaseClient, studentId: string, email: string, password: string) {
  const verifier = createPasswordVerificationClient();
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  if (error || data.user?.id !== studentId || !data.session) throw new Error("session_revocation_failed");
  const { error: revokeError } = await admin.auth.admin.signOut(data.session.access_token, "global");
  if (revokeError) throw new Error("session_revocation_failed");
}

export async function issueTeacherStudentTemporaryPassword(
  admin: SupabaseClient,
  student: { id: string; email: string },
  actorId: string
): Promise<TemporaryPasswordResult> {
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(student.id);
  if (accountError || account.user?.email?.toLowerCase() !== student.email.toLowerCase() || !account.user.email_confirmed_at) {
    return { ok: false, message: "This pupil's verified sign-in account could not be confirmed. Ask an administrator to check it." };
  }
  const { data: operation, error: beginError } = await admin.rpc("begin_student_password_operation", {
    p_student: student.id, p_actor: actorId, p_operation: "issue", p_reset: null,
  });
  if (beginError || !operation?.operation_id) return { ok: false, message: passwordOperationMessage(beginError?.message ?? "") };
  const password = generateTemporaryPassword();
  try {
    const { error } = await admin.auth.admin.updateUserById(student.id, { password });
    if (error) throw new Error("password_update_failed");
    await revokeStudentPasswordSessions(admin, student.id, student.email, password);
    const { error: finishError } = await admin.rpc("finish_student_password_operation", {
      p_student: student.id, p_operation_id: operation.operation_id, p_success: true,
    });
    if (finishError) throw new Error("password_reset_incomplete");
    return { ok: true, message: "Temporary password created. The pupil must choose their own password at sign-in.", temporaryPassword: password, expiresAt: operation.expires_at };
  } catch {
    // Fail closed. An uncertain Auth response must never clear the required-change
    // flag or expose a credential whose reset/audit did not finish successfully.
    await admin.rpc("finish_student_password_operation", {
      p_student: student.id, p_operation_id: operation.operation_id, p_success: false,
    });
    return { ok: false, message: "The reset could not be completed. Pupil access is restricted until a new temporary password is created. Please retry." };
  }
}
