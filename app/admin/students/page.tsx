import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/PageHero";
import MoveStudentForm from "./MoveStudentForm";
import ResetStudentPasswordButton from "./ResetStudentPasswordButton";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default async function StudentsAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: students }, { data: classes }, { data: memberships }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, created_at, disabled_at").eq("role", "student").order("display_name"),
    supabase.from("classes").select("id, name").is("archived_at", null).order("name"),
    supabase.from("class_members").select("student_id, class_id, joined_at, classes(name)"),
    supabase.from("student_account_audit").select("id, target_email, target_display_name, actor_email, action, reason, outcome, occurred_at, from_class_ids, to_class_id").order("occurred_at", { ascending: false }).limit(50),
  ]);

  const classOptions = ((classes as any[]) ?? []).map((klass) => ({ id: klass.id, name: klass.name }));
  const membershipsByStudent = new Map<string, any[]>();
  for (const membership of (memberships as any[]) ?? []) {
    membershipsByStudent.set(membership.student_id, [...(membershipsByStudent.get(membership.student_id) ?? []), membership]);
  }

  return (
    <div className="space-y-8">
      <PageHero latinTag="Discipuli" title="Students" subtitle="Move pupils between classes and provide secure password recovery links." variant="colosseum" />

      <section>
        <h2 className="h-display text-xl mb-3">Student accounts</h2>
        {!students?.length ? <p className="text-ink/60">No student accounts yet.</p> : (
          <ul className="card divide-y divide-ink/10">
            {(students as any[]).map((student) => {
              const studentMemberships = membershipsByStudent.get(student.id) ?? [];
              const currentClassId = studentMemberships.length === 1 ? studentMemberships[0].class_id : null;
              return (
                <li key={student.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{student.display_name ?? student.email}</div>
                      <div className="text-xs text-ink/60">{student.email} · joined {formatDate(student.created_at)}</div>
                      <div className="text-xs text-ink/60 mt-1">
                        Class: {studentMemberships.length ? studentMemberships.map((membership) => membership.classes?.name ?? "Unknown class").join(", ") : "Not assigned"}
                      </div>
                    </div>
                    <ResetStudentPasswordButton studentId={student.id} email={student.email} />
                  </div>
                  <MoveStudentForm studentId={student.id} currentClassId={currentClassId} classes={classOptions} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h-display text-xl mb-1">Student account audit</h2>
        <p className="text-sm text-ink/60 mb-3">Administrator class moves and password-recovery actions are recorded here.</p>
        {!audit?.length ? <p className="text-ink/60">No student account actions recorded yet.</p> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b border-ink/10"><tr><th className="p-3">Date</th><th className="p-3">Action</th><th className="p-3">Student</th><th className="p-3">Administrator</th><th className="p-3">Result</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {(audit as any[]).map((entry) => (
                  <tr key={entry.id}><td className="p-3 whitespace-nowrap">{formatDate(entry.occurred_at)}</td><td className="p-3 capitalize">{entry.action.replaceAll("_", " ")}</td><td className="p-3">{entry.target_display_name ?? entry.target_email}</td><td className="p-3">{entry.actor_email ?? "Removed administrator"}</td><td className="p-3"><div>{entry.reason ?? "—"}</div><div className="text-xs capitalize text-ink/60">{entry.outcome}</div></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

