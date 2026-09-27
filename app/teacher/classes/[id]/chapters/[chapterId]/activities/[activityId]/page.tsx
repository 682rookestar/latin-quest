import Link from "next/link";
import { redirect } from "next/navigation";
import {
  summariseActivity,
  summarisePupilAttempts,
  type ActivityAttempt,
} from "@/lib/activity-analytics";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ActivityDetail({
  params,
}: {
  params: Promise<{ id: string; chapterId: string; activityId: string }>;
}) {
  const { id, chapterId, activityId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: klass }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("classes")
      .select("id, name")
      .eq("id", id)
      .eq("teacher_id", user.id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (profile?.role !== "teacher") redirect("/learn");
  if (!klass) redirect("/teacher");

  const [{ data: chapter }, { data: activity }, { data: members }] = await Promise.all([
    supabase.from("chapters").select("id, number, title").eq("id", chapterId).maybeSingle(),
    supabase
      .from("exercises")
      .select("id, title, description, game_type")
      .eq("id", activityId)
      .eq("chapter_id", chapterId)
      .maybeSingle(),
    supabase
      .from("class_members")
      .select("student_id, profiles(id, display_name, email)")
      .eq("class_id", id),
  ]);
  if (!chapter || !activity) redirect(`/teacher/classes/${id}`);

  const studentIds = (members ?? []).map((member) => member.student_id);
  const attempts: ActivityAttempt[] = [];
  if (studentIds.length) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("attempts")
        .select("student_id, exercise_id, score_pct, completed_at")
        .eq("exercise_id", activityId)
        .in("student_id", studentIds)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      attempts.push(...((data ?? []) as ActivityAttempt[]));
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }

  const classSummary = summariseActivity(attempts, studentIds.length);
  const attemptsByPupil = new Map<string, ActivityAttempt[]>();
  for (const attempt of attempts) {
    const rows = attemptsByPupil.get(attempt.student_id) ?? [];
    rows.push(attempt);
    attemptsByPupil.set(attempt.student_id, rows);
  }

  const pupilRows = (members ?? []).map((member: any) => {
    const pupil = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: member.student_id,
      name: pupil?.display_name ?? pupil?.email ?? "Unknown pupil",
      email: pupil?.email ?? "",
      summary: summarisePupilAttempts(attemptsByPupil.get(member.student_id) ?? []),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <Link
        href={`/teacher/classes/${id}/chapters/${chapterId}`}
        className="text-sm text-ink/60 hover:underline"
      >
        &lsaquo; back to Chapter {chapter.number}
      </Link>

      <header>
        <p className="h-display text-sky text-xs tracking-[0.3em] mb-1">
          {klass.name} &middot; Chapter {chapter.number}
        </p>
        <h1 className="h-display text-3xl">{activity.title}</h1>
        {activity.description && <p className="text-sm text-ink/60 mt-2">{activity.description}</p>}
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><div className="text-xs text-ink/60">Pupils completed</div><div className="text-2xl font-semibold mt-1">{classSummary.pupilsCompleted}/{classSummary.pupilCount}</div></div>
        <div className="card p-4"><div className="text-xs text-ink/60">Completion</div><div className="text-2xl font-semibold mt-1">{classSummary.completionRate}%</div></div>
        <div className="card p-4"><div className="text-xs text-ink/60">Total attempts</div><div className="text-2xl font-semibold mt-1">{classSummary.totalAttempts}</div></div>
        <div className="card p-4"><div className="text-xs text-ink/60">Class average</div><div className="text-2xl font-semibold mt-1">{classSummary.averageScore == null ? "-" : `${classSummary.averageScore}%`}</div></div>
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Pupil activity</h2>
        {!pupilRows.length ? (
          <div className="card p-5 text-ink/60">There are no pupils in this class yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink/10 text-left text-xs text-ink/60">
                <tr>
                  <th className="p-3">Pupil</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Attempts</th>
                  <th className="p-3 text-right">Best</th>
                  <th className="p-3 text-right">Latest</th>
                  <th className="p-3">Last completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {pupilRows.map((pupil) => (
                  <tr key={pupil.id}>
                    <td className="p-3">
                      <Link href={`/teacher/classes/${id}/students/${pupil.id}`} className="font-medium hover:underline">
                        {pupil.name}
                      </Link>
                      <div className="text-xs text-ink/50">{pupil.email}</div>
                    </td>
                    <td className="p-3">
                      {pupil.summary.attempts ? <span className="chip-olive">Completed</span> : <span className="text-ink/40">Not attempted</span>}
                    </td>
                    <td className="p-3 text-right font-mono">{pupil.summary.attempts}</td>
                    <td className="p-3 text-right">{pupil.summary.bestScore == null ? "-" : `${pupil.summary.bestScore}%`}</td>
                    <td className="p-3 text-right">{pupil.summary.latestScore == null ? "-" : `${pupil.summary.latestScore}%`}</td>
                    <td className="p-3 whitespace-nowrap">{formatDate(pupil.summary.lastCompletedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
