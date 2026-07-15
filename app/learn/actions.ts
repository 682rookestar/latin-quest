"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── Scoring helpers (canonical server-side versions) ──────────────────────
// These are the only authoritative scorers. The client component no longer
// scores anything — it sends raw answers and receives results back.

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Replace all punctuation (including direct-speech marks) with spaces so
    // students don't need to reproduce quotes, exclamation marks, etc.
    .replace(/["""'''„«»!?.,;:()\[\]{}/\\—–\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemWord(w: string): string {
  return w
    .replace(/(?:ing|tion|ness|ment)$/, "")
    .replace(/(?:ed|er|est|ly)$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "")
    .replace(/e$/, "");
}

function eqLoose(student: string, correct: string): boolean {
  return strip(student) === strip(correct);
}

function translationOk(student: string, correct: string): boolean {
  const a = strip(student);
  const b = strip(correct);
  if (!a) return false;
  if (a === b) return true;
  const studentWords = a.split(" ");
  const correctKeywords = b.split(" ").filter((w) => w.length > 3);
  if (studentWords.length < Math.ceil(correctKeywords.length * 0.5)) return false;
  const uniqueRatio = new Set(studentWords).size / studentWords.length;
  if (studentWords.length > 3 && uniqueRatio < 0.6) return false;
  const studentStems = new Set(studentWords.map(stemWord));
  const hits = correctKeywords.filter((w) => studentStems.has(stemWord(w))).length;
  return correctKeywords.length > 0 && hits / correctKeywords.length >= 0.8;
}

function scoreAnswer(
  studentAnswer: string,
  correctAnswer: string,
  gameType: string,
  metadata: unknown
): boolean {
  if (gameType === "word_type_sort") {
    const md = metadata as { words?: { word: string; type: string }[] } | null;
    const items = md?.words ?? [];
    let studentObj: Record<string, string> = {};
    try { studentObj = JSON.parse(studentAnswer); } catch { /* invalid JSON = wrong */ }
    return items.every((it) => studentObj[it.word] === it.type);
  }
  if (gameType === "translation") return translationOk(studentAnswer, correctAnswer);
  return eqLoose(studentAnswer, correctAnswer);
}

// ─── Per-question check (for immediate feedback) ────────────────────────────
// Called after the student clicks "Check". Returns is_correct and the
// canonical correct answer (revealed only AFTER the student has committed).
export async function checkAnswer(
  questionId: string,
  studentAnswer: string
): Promise<{ is_correct: boolean; correct_answer: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { is_correct: false, correct_answer: "" };

  const { data } = await supabase
    .from("exercise_questions")
    .select("correct_answer, metadata, exercises(game_type)")
    .eq("id", questionId)
    .single();

  if (!data) return { is_correct: false, correct_answer: "" };

  const correctAnswer: string = (data as any).correct_answer ?? "";
  const parentExercise = (data as any).exercises as { game_type: string } | null;
  const gameType: string =
    ((data as any).metadata as any)?.__game_type ??
    parentExercise?.game_type ??
    "multiple_choice";

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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const questionIds = answers.map((a) => a.question_id);

  // Fetch canonical correct answers for every submitted question
  const { data: questions, error: qErr } = await supabase
    .from("exercise_questions")
    .select("id, correct_answer, metadata, exercises(game_type)")
    .in("id", questionIds);

  if (qErr || !questions) throw new Error("Could not load questions");

  const qMap = new Map((questions as any[]).map((q) => [q.id, q]));

  // Score every answer server-side from canonical DB data
  const results = answers.map(({ question_id, student_answer }) => {
    const q = qMap.get(question_id) as any | undefined;
    if (!q) return { question_id, is_correct: false, correct_answer: "" };
    const correctAnswer: string = q.correct_answer ?? "";
    const parentExercise = q.exercises as { game_type: string } | null;
    const gameType: string =
      q.metadata?.__game_type ?? parentExercise?.game_type ?? "multiple_choice";
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

  const { data: summary, error: rpcErr } = await supabase
    .rpc("submit_exercise_attempt", {
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
  const supabase = createClient();
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
