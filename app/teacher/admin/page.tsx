import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import { hasAal2 } from "@/lib/auth-security";
import { createClient } from "@/lib/supabase/server";
import ResetStudentPasswordButton from "./ResetStudentPasswordButton";

type StudentRow = {
  id: string;
  email: string;
  displayName: string | null;
  classNames: string[];
};

export default async function TeacherAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "teacher" || profile.disabled_at) redirect("/dashboard");
  if (!(await hasAal2(supabase))) redirect("/account?mfa=required");

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .is("archived_at", null)
    .order("name");
  const classIds = (classes ?? []).map((klass) => klass.id);
  const classNames = new Map((classes ?? []).map((klass) => [klass.id, klass.name]));

  const { data: memberships } = classIds.length
    ? await supabase
        .from("class_members")
        .select("student_id, class_id, profiles(id, email, display_name, disabled_at)")
        .in("class_id", classIds)
    : { data: [] as any[] };

  const studentsById = new Map<string, StudentRow>();
  for (const membership of (memberships ?? []) as any[]) {
    const pupil = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles;
    if (!pupil || pupil.disabled_at || !pupil.email) continue;
    const existing = studentsById.get(pupil.id);
    const className = classNames.get(membership.class_id);
    if (existing) {
      if (className && !existing.classNames.includes(className)) existing.classNames.push(className);
    } else {
      studentsById.set(pupil.id, {
        id: pupil.id,
        email: pupil.email,
        displayName: pupil.display_name,
        classNames: className ? [className] : [],
      });
    }
  }
  const students = [...studentsById.values()].sort((a, b) =>
    (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email)
  );

  return (
    <div className="space-y-8">
      <PageHero
        latinTag="Administratio"
        title="Teacher admin"
        subtitle="Create secure one-time password recovery links for pupils in your classes."
        variant="colosseum"
      />

      <section>
        <h2 className="h-display text-xl mb-1">Pupil accounts</h2>
        <p className="text-sm text-ink/60 mb-3">
          A recovery link does not reveal the pupil&apos;s password. Send it privately and only to the pupil or an authorised adult.
        </p>
        {!classIds.length ? (
          <div className="card p-6 text-ink/60">You do not currently have an active class.</div>
        ) : !students.length ? (
          <div className="card p-6 text-ink/60">No active pupils are enrolled in your classes.</div>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {students.map((student) => (
              <li key={student.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{student.displayName ?? student.email}</div>
                  <div className="text-xs text-ink/60">{student.email}</div>
                  <div className="text-xs text-ink/60 mt-1">Class: {student.classNames.join(", ")}</div>
                </div>
                <ResetStudentPasswordButton studentId={student.id} email={student.email} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
