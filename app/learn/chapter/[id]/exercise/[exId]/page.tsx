import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExerciseRunner from "@/components/ExerciseRunner";

const BOSS_SAMPLE_SIZE = 15;

export default async function ExercisePage({
  params,
}: {
  params: { id: string; exId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercise } = await supabase
    .from("exercises").select("*").eq("id", params.exId).single();
  if (!exercise) notFound();

  // Honour the per-class chapter lock here too -- a student could
  // otherwise bookmark a deep exercise URL and bypass the /learn UI.
  const { data: lockedRows } = await supabase.rpc("locked_chapters_for_me");
  const isLocked = ((lockedRows as any[]) ?? []).some(
    (r) => r.chapter_id === exercise.chapter_id
  );
  if (isLocked) redirect("/learn?locked=1");

  let questions: any[] = [];

  if (exercise.is_boss) {
    // Pull all sibling exercises in this chapter (non-boss), and a generous
    // sample of their questions. We then shuffle and slice client-server-side
    // and tag each question with its source game_type + skill_id so the
    // runner can render and score it correctly.
    const { data: siblings } = await supabase
      .from("exercises")
      .select("id, game_type, skill_id")
      .eq("chapter_id", exercise.chapter_id)
      .eq("is_boss", false);

    const siblingIds = (siblings ?? []).map((s: any) => s.id);
    if (siblingIds.length === 0) {
      questions = [];
    } else {
      const { data: pool } = await supabase
        .from("exercise_questions")
        .select("id, exercise_id, prompt, correct_answer, options, metadata, position")
        .in("exercise_id", siblingIds);

      const byParent: Record<string, { game_type: string; skill_id: string | null }> = {};
      for (const s of siblings as any[]) byParent[s.id] = { game_type: s.game_type, skill_id: s.skill_id };

      const annotated = (pool ?? []).map((q: any) => ({
        ...q,
        metadata: {
          ...(q.metadata ?? {}),
          __game_type: byParent[q.exercise_id]?.game_type ?? "multiple_choice",
          __skill_id: byParent[q.exercise_id]?.skill_id ?? null,
        },
      }));

      // Filter out word_type_sort and preposition_picture: they need full
      // metadata we'd rather treat as their own gameplay loop than a quick boss
      // hit. (Keep them in their regular exercises.)
      const playable = annotated.filter(
        (q) => !["word_type_sort", "preposition_picture"].includes(q.metadata.__game_type as string)
      );

      // Fisher-Yates, take first N
      for (let i = playable.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playable[i], playable[j]] = [playable[j], playable[i]];
      }
      questions = playable.slice(0, BOSS_SAMPLE_SIZE).map((q, idx) => ({ ...q, position: idx + 1 }));
    }
  } else {
    const { data: own } = await supabase
      .from("exercise_questions")
      .select("*")
      .eq("exercise_id", params.exId)
      .order("position");

    // Shuffle the question order on every attempt so the same exercise
    // feels fresh on replay. The question set is unchanged -- only the
    // sequence varies -- so it's safe for grade-marking and stays simple
    // for teachers to discuss in class.
    const list = [...(own ?? [])];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // Re-stamp position so the runner's "Question N of M" counter
    // numbers them in the new (shuffled) order.
    questions = list.map((q, idx) => ({ ...q, position: idx + 1 }));
  }

  return (
    <ExerciseRunner
      exercise={exercise}
      questions={questions}
      backHref={`/learn/chapter/${params.id}`}
    />
  );
}
