"use server";

import { revalidatePath } from "next/cache";
import { hasAal2 } from "@/lib/auth-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TeacherStudentPasswordResetResult = {
  ok: boolean;
  message: string;
  recoveryLink?: string;
};

export async function resetTeacherStudentPassword(
  _previous: TeacherStudentPasswordResetResult | null,
  formData: FormData
): Promise<TeacherStudentPasswordResetResult> {
  const studentId = String(formData.get("student_id") ?? "");
  if (!studentId) return { ok: false, message: "Missing pupil account." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in." };

  const { data: teacher } = await supabase
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", user.id)
    .single();
  if (teacher?.role !== "teacher" || teacher.disabled_at) {
    return { ok: false, message: "Teacher access is required." };
  }
  if (!(await hasAal2(supabase))) {
    return { ok: false, message: "Two-factor authentication is required. Re-authenticate on the Account page." };
  }

  // The service-role client is used only after authenticating the teacher and
  // is constrained here to pupils in classes they currently own. This check is
  // deliberately repeated server-side; the submitted pupil id is never trusted.
  const admin = createAdminClient();
  const { data: ownedClasses, error: classesError } = await admin
    .from("classes")
    .select("id")
    .eq("teacher_id", user.id)
    .is("archived_at", null);
  const ownedClassIds = (ownedClasses ?? []).map((klass) => klass.id);
  if (classesError || !ownedClassIds.length) {
    return { ok: false, message: "You can only reset passwords for pupils in your active classes." };
  }

  const { data: membership, error: membershipError } = await admin
    .from("class_members")
    .select("student_id")
    .eq("student_id", studentId)
    .in("class_id", ownedClassIds)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return { ok: false, message: "You can only reset passwords for pupils in your active classes." };
  }

  const { data: student, error: studentError } = await admin
    .from("profiles")
    .select("id, email, display_name, role, disabled_at")
    .eq("id", studentId)
    .single();
  if (studentError || !student || student.role !== "student" || student.disabled_at || !student.email) {
    return { ok: false, message: "Only an active pupil can receive a recovery link." };
  }

  const auditEntry = {
    target_user_id: student.id,
    target_email: student.email,
    target_display_name: student.display_name,
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: "reset_password",
    reason: "Teacher-issued one-time recovery link",
    outcome: "pending",
  };
  const { data: audit, error: auditError } = await admin
    .from("student_account_audit")
    .insert(auditEntry)
    .select("id")
    .single();
  if (auditError || !audit) {
    return { ok: false, message: "Could not create the required audit record. Nothing was changed." };
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: student.email,
    options: { redirectTo: origin ? `${origin}/account` : undefined },
  });
  const hashedToken =
    (linkData as any)?.properties?.hashed_token ??
    (linkData as any)?.hashed_token ??
    null;
  if (linkError || !origin || !hashedToken) {
    await admin.from("student_account_audit").update({ outcome: "failed" }).eq("id", audit.id);
    return { ok: false, message: "Could not generate a secure recovery link. No password was changed." };
  }

  const recoveryLink = `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=/account`;
  const { error: outcomeError } = await admin
    .from("student_account_audit")
    .update({ outcome: "success" })
    .eq("id", audit.id);
  if (outcomeError) {
    return { ok: false, message: "The link was generated, but its audit record could not be completed. Please generate another link." };
  }

  revalidatePath("/teacher/admin");
  return {
    ok: true,
    message: `One-time recovery link created for ${student.email}.`,
    recoveryLink,
  };
}
