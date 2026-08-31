"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreAnswer } from "@/lib/scoring";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseAccess = {
  userId: string;
  exercise: { id: string; chapter_id: string; is_boss: boolean };
  admin: ReturnType<typeof createAdminClient>;
};

async function getStudentExerciseAccess(exerciseId: string): Promise<ExerciseAccess | null> {
  if (!exerciseId) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }, { data: exercise }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("class_members").select("class_id").eq("student_id", user.id).limit(1).maybeSingle(),
    supabase.from("exercises").select("id, chapter_id, is_boss").eq("id", exerciseId).single(),
  ]);
  if (profile?.role !== "student" || !membership || !exercise) return null;

  const { data: lockedRows } = await supabase.rpc("locked_chapters_for_me");
  if (((lockedRows as any[]) ?? []).some((row) => row.chapter_id === exercise.chapter_id)) {
    return null;
  }

  return {
    userId: user.id,
    exercise: exercise as ExerciseAccess["exercise"],
    admin: createAdminClient(),
  };
}

function questionBelongsToExercise(
  target: ExerciseAccess["exercise"],
  question: any
): boolean {
  const source = Array.isArray(question.exercises)
    ? question.exercises[0]
    : question.exercises;
  if (!source) return false;

  return target.is_boss
    ? source.chapter_id === target.chapter_id && source.is_boss === false
    : question.exercise_id === target.id;
}

// ─── Per-question check (for immediate feedback) ────────────────────────────
// Called after the student clicks "Check". Returns is_correct and the
// canonical correct answer (revealed only AFTER the student has committed).
export async function checkAnswer(
  exerciseId: string,
  questionId: string,
  studentAnswer: string
): Promise<{ is_correct: boolean; correct_answer: string }> {
  if (!exerciseId || !questionId || studentAnswer.length > 5000) {
    return { is_correct: false, correct_answer: "" };
  }
  const access = await getStudentExerciseAccess(exerciseId);
  if (!access) return { is_correct: false, correct_answer: "" };

  const { data: allowed, error: rateError } = await access.admin.rpc(
    "consume_exercise_rate_limit",
    { p_student: access.userId, p_action: "check" }
  );
  if (rateError || allowed !== true) {
    return { is_correct: false, correct_answer: "" };
  }

  const { data } = await access.admin
    .from("exercise_questions")
    .select("exercise_id, correct_answer, metadata, exercises(game_type, chapter_id, is_boss)")
    .eq("id", questionId)
    .single();

  if (!data || !questionBelongsToExercise(access.exercise, data)) {
    return { is_correct: false, correct_answer: "" };
  }

  const correctAnswer: string = (data as any).correct_answer ?? "";
  const parentExercise = (data as any).exercises as { game_type: string } | null;
  const gameType: string = parentExercise?.game_type ?? "multiple_choice";

  return {
    is_correct: scoreAnswer(studentAnswer, correctAnswer, gameType, (data as any).metadata),
    correct_answer: correctAnswer,
  };
}

// ─── Final submission (atomic, tamper-proof) ────────────────────────────────
// Called once, after all questions are answered. The client sends only raw
// answers; this function fetches canonical answers from the DB, re-scores
// every answer, then commits everything atomically via the
// submit_exercise_attempt SECURITY DEFINER RPC.
export async function submitExercise(
  exerciseId: string,
  answers: { question_id: string; student_answer: string }[]
): Promise<{
  score_pct: number;
  correct: number;
  total: number;
  results: { question_id: string; is_correct: boolean; correct_answer: string }[];
  badge_earned: boolean;
}> {
  const access = await getStudentExerciseAccess(exerciseId);
  if (!access) throw new Error("Not authorised");

  const questionIds = answers.map((a) => a.question_id);
  if (
    answers.length < 1 ||
    answers.length > 100 ||
    new Set(questionIds).size !== questionIds.length ||
    answers.some((answer) => !answer.question_id || answer.student_answer.length > 5000)
  ) {
    throw new Error("Invalid answers");
  }

  const { data: allowed, error: rateError } = await access.admin.rpc(
    "consume_exercise_rate_limit",
    { p_student: access.userId, p_action: "submit" }
  );
  if (rateError || allowed !== true) throw new Error("Too many submissions");

  // Fetch canonical correct answers for every submitted question
  const { data: questions, error: qErr } = await access.admin
    .from("exercise_questions")
    .select("id, exercise_id, correct_answer, metadata, exercises(game_type, chapter_id, is_boss)")
    .in("id", questionIds);

  if (
    qErr ||
    !questions ||
    questions.length !== questionIds.length ||
    (questions as any[]).some((question) => !questionBelongsToExercise(access.exercise, question))
  ) {
    throw new Error("Could not load questions");
  }

  const qMap = new Map((questions as any[]).map((q) => [q.id, q]));

  // Score every answer server-side from canonical DB data
  const results = answers.map(({ question_id, student_answer }) => {
    const q = qMap.get(question_id) as any | undefined;
    if (!q) return { question_id, is_correct: false, correct_answer: "" };
    const correctAnswer: string = q.correct_answer ?? "";
    const parentExercise = q.exercises as { game_type: string } | null;
    const gameType: string = parentExercise?.game_type ?? "multiple_choice";
    return {
      question_id,
      is_correct: scoreAnswer(student_answer, correctAnswer, gameType, q.metadata),
      correct_answer: correctAnswer,
    };
  });

  // Build the payload for the SECURITY DEFINER RPC
  const rpcPayload = answers.map((a, idx) => ({
    question_id:    a.question_id,
    student_answer: a.student_answer,
    is_correct:     results[idx].is_correct,
  }));

  // This RPC is deliberately granted only to the service role. The browser
  // and authenticated Supabase clients cannot submit their own correctness
  // flags or progress values directly.
  const { data: summary, error: rpcErr } = await access.admin
    .rpc("submit_exercise_attempt", {
      p_student:     access.userId,
      p_exercise_id: exerciseId,
      p_answers:     rpcPayload,
    })
    .single();

  if (rpcErr) throw new Error(`Submission failed: ${rpcErr.message}`);

  const s = summary as { score_pct: number; correct: number; total: number; badge_earned: boolean };
  return {
    score_pct:    s.score_pct,
    correct:      s.correct,
    total:        s.total,
    results,
    badge_earned: s.badge_earned,
  };
}

export async function joinClass(formData: FormData): Promise<void> {
  // Strip whitespace and uppercase. The RPC also normalises, but doing it
  // here keeps the rate-limit accounting honest (junk input still counts).
  const raw = ((formData.get("code") as string) || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!raw) {
    redirect("/learn/join?error=missing");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .rpc("join_class_by_code", { p_code: raw })
    .maybeSingle();

  if (error) {
    // The RPC raises 'rate_limited' when a user has tried too many codes
    // in a short window. Every other error gets a generic message so we
    // don't leak DB internals or hint at which codes exist.
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("rate_limited")) {
      redirect("/learn/join?error=ratelimited");
    }
    redirect("/learn/join?error=invalid");
  }
  if (!data) {
    // Empty result = code unknown or expired. Same generic error.
    redirect("/learn/join?error=invalid");
  }

  revalidatePath("/learn");
  redirect("/learn");
}
