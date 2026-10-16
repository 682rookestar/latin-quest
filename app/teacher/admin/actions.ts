"use server";

import { revalidatePath } from "next/cache";
import { hasAal2 } from "@/lib/auth-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { issueTeacherStudentTemporaryPassword } from "@/lib/student-password-reset";
import type { TemporaryPasswordResult } from "@/lib/student-password";

export type TeacherStudentPasswordResetResult = TemporaryPasswordResult;

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
    return { ok: false, message: "Only an active pupil can receive a temporary password." };
  }

  const result = await issueTeacherStudentTemporaryPassword(admin, { id: student.id, email: student.email }, user.id);
  if (result.ok) revalidatePath("/teacher/admin");
  return result;
}
