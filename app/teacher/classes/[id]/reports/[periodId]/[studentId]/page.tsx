import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportEditor from "./ReportEditor";

const EMPTY_REPORT = {
  bfl_engagement: null,
  bfl_classwork: null,
  bfl_independent_study: null,
  progress_grade: null,
  lesson_observations: "",
  strengths: "",
  improvement_targets: "",
  school_values: "",
  bene_notes: "",
  current_comment: "",
  status: "draft",
};

export default async function StudentReportPage({
  params,
}: {
  params: Promise<{ id: string; periodId: string; studentId: string }>;
}) {
  const { id, periodId, studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: klass }, { data: period }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("role, disabled_at").eq("id", user.id).single(),
    supabase.from("classes").select("id, name, teacher_id, archived_at").eq("id", id).single(),
    supabase.from("reporting_periods").select("id, class_id, name, starts_on, ends_on, status").eq("id", periodId).single(),
    supabase.from("class_members").select("student_id, profiles(display_name, email)").eq("class_id", id).eq("student_id", studentId).maybeSingle(),
  ]);
  const isAdmin = profile?.role === "admin";
  const isOwningTeacher = profile?.role === "teacher" && klass?.teacher_id === user.id;
  if (!profile || profile.disabled_at || (!isAdmin && !isOwningTeacher)) redirect("/learn");
  if (!klass || klass.archived_at || !period || period.class_id !== id || !membership) redirect(`/teacher/classes/${id}/reports`);

  const pupil: any = Array.isArray((membership as any).profiles)
    ? (membership as any).profiles[0]
    : (membership as any).profiles;
  const preferredName = pupil?.display_name || pupil?.email?.split("@")[0] || "Pupil";
  const [{ data: report }, { data: attempts }] = await Promise.all([
    supabase
      .from("student_reports")
      .select("*")
      .eq("period_id", periodId)
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("attempts")
      .select("score_pct, total_questions, correct_questions, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .gte("completed_at", `${period.starts_on}T00:00:00.000Z`)
      .lte("completed_at", `${period.ends_on}T23:59:59.999Z`),
  ]);
  const total = attempts?.length ?? 0;
  const average = total
    ? Math.round((attempts ?? []).reduce((sum, attempt) => sum + (attempt.score_pct ?? 0), 0) / total)
    : null;
  const questions = (attempts ?? []).reduce((sum, attempt) => sum + (attempt.total_questions ?? 0), 0);
  const correct = (attempts ?? []).reduce((sum, attempt) => sum + (attempt.correct_questions ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/teacher/classes/${id}/reports`} className="text-sm text-ink/60 hover:underline">
          &lsaquo; back to {period.name}
        </Link>
        <p className="h-display text-sky text-xs tracking-[0.3em] mt-5 mb-1">Subject report</p>
        <h1 className="h-display text-3xl">{preferredName}</h1>
        <p className="text-sm text-ink/60">{klass.name} &middot; {period.name}</p>
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><div className="text-xs text-ink/50">Completed activities</div><div className="text-2xl mt-1">{total}</div></div>
        <div className="card p-4"><div className="text-xs text-ink/50">Average score</div><div className="text-2xl mt-1">{average == null ? "-" : `${average}%`}</div></div>
        <div className="card p-4"><div className="text-xs text-ink/50">Questions answered</div><div className="text-2xl mt-1">{questions}</div></div>
        <div className="card p-4"><div className="text-xs text-ink/50">Questions correct</div><div className="text-2xl mt-1">{correct}</div></div>
      </section>

      <ReportEditor
        key={(report as any)?.updated_at ?? "new"}
        classId={id}
        periodId={periodId}
        studentId={studentId}
        preferredName={preferredName}
        report={{ ...EMPTY_REPORT, ...((report ?? {}) as any) }}
      />
    </div>
  );
}
