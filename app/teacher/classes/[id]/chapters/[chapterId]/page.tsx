import Link from "next/link";
import { redirect } from "next/navigation";
import { summariseActivity, type ActivityAttempt } from "@/lib/activity-analytics";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

async function loadAttempts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIds: string[],
  exerciseIds: string[]
) {
  if (!studentIds.length || !exerciseIds.length) return [];
  const rows: ActivityAttempt[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("attempts")
      .select("student_id, exercise_id, score_pct, completed_at")
      .in("student_id", studentIds)
      .in("exercise_id", exerciseIds)
      .not("completed_at", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ActivityAttempt[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return rows;
}

export default async function ChapterActivities({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
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

  const [{ data: chapter }, { data: members }, { data: exercises }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, number, title")
      .eq("id", chapterId)
      .maybeSingle(),
    supabase.from("class_members").select("student_id").eq("class_id", id),
    supabase
      .from("exercises")
      .select("id, title, description, game_type, position")
      .eq("chapter_id", chapterId)
      .order("position")
      .order("title"),
  ]);
  if (!chapter) redirect(`/teacher/classes/${id}`);

  const studentIds = (members ?? []).map((member) => member.student_id);
  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);
  const attempts = await loadAttempts(supabase, studentIds, exerciseIds);
  const byExercise = new Map<string, ActivityAttempt[]>();
  for (const attempt of attempts) {
    const rows = byExercise.get(attempt.exercise_id) ?? [];
    rows.push(attempt);
    byExercise.set(attempt.exercise_id, rows);
  }

  return (
    <div className="space-y-8">
      <Link href={`/teacher/classes/${id}`} className="text-sm text-ink/60 hover:underline">
        &lsaquo; back to {klass.name}
      </Link>

      <header>
        <p className="h-display text-sky text-xs tracking-[0.3em] mb-1">Activity analytics</p>
        <h1 className="h-display text-3xl">Chapter {chapter.number}: {chapter.title}</h1>
        <p className="text-sm text-ink/60 mt-2">
          Select an activity to see who has completed it, repeat attempts and best scores.
        </p>
      </header>

      {!exercises?.length ? (
        <div className="card p-5 text-ink/60">There are no activities in this chapter yet.</div>
      ) : (
        <div className="card divide-y divide-ink/10">
          {exercises.map((exercise) => {
            const summary = summariseActivity(byExercise.get(exercise.id) ?? [], studentIds.length);
            return (
              <Link
                key={exercise.id}
                href={`/teacher/classes/${id}/chapters/${chapterId}/activities/${exercise.id}`}
                className="block p-4 hover:bg-ink/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{exercise.title}</h2>
                    {exercise.description && <p className="text-sm text-ink/60 mt-1">{exercise.description}</p>}
                    <p className="text-xs text-ink/50 mt-1">{exercise.game_type.replaceAll("_", " ")}</p>
                  </div>
                  <span className="text-ink/40">&rsaquo;</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  <span className="chip-wine">{summary.pupilsCompleted}/{summary.pupilCount} pupils</span>
                  <span className="chip-gold">{summary.totalAttempts} attempt{summary.totalAttempts === 1 ? "" : "s"}</span>
                  {summary.averageScore != null && <span className="chip-olive">class avg {summary.averageScore}%</span>}
                  {summary.bestScore != null && <span className="chip-olive">best {summary.bestScore}%</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
