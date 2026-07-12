import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExerciseRunner from "@/components/ExerciseRunner";
import type { ExerciseQuestionPublic } from "@/lib/types";

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

    const list = [...(own ?? [])];

    // Look up this student's prior history on these specific questions
    // so we can put their weak spots first. attempt_answers has no
    // student_id, so we filter through the attempts FK.
    const questionIds = list.map((q: any) => q.id);
    const history: Record<string, { right: number; wrong: number }> = {};
    if (questionIds.length > 0) {
      const { data: prev } = await supabase
        .from("attempt_answers")
        .select("question_id, is_correct, attempts!inner(student_id)")
        .in("question_id", questionIds)
        .eq("attempts.student_id", user.id);
      for (const a of (prev ?? []) as any[]) {
        const h = (history[a.question_id] ??= { right: 0, wrong: 0 });
        if (a.is_correct) h.right += 1; else h.wrong += 1;
      }
    }

    // Score = (#wrong) - (#right). Higher score = needs more practice.
    //   never seen     -> 0
    //   always wrong   -> +N
    //   always right   -> -N
    //   half-and-half  -> ~0
    // Sort descending; ties broken randomly so the order still feels
    // fresh between attempts.
    const scored = list.map((q: any) => {
      const h = history[q.id] ?? { right: 0, wrong: 0 };
      return { q, score: h.wrong - h.right, jitter: Math.random() };
    });
    scored.sort((a, b) => (b.score - a.score) || (a.jitter - b.jitter));

    // Re-stamp position so the runner's "Question N of M" counter
    // numbers them in the new (priority) order.
    questions = scored.map((s, idx) => ({ ...s.q, position: idx + 1 }));
  }

  // Strip correct_answer before sending to the client component.
  // Scoring is now entirely server-side; the browser never sees answers.
  const publicQuestions: ExerciseQuestionPublic[] = (questions as any[]).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ correct_answer: _removed, ...rest }) => rest
  );

  return (
    <ExerciseRunner
      exercise={exercise}
      questions={publicQuestions}
      backHref={`/learn/chapter/${params.id}`}
    />
  );
}
