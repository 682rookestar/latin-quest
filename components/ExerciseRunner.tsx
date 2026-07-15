"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Exercise, ExerciseQuestionPublic, GameType } from "@/lib/types";
import { checkAnswer, submitExercise } from "@/app/learn/actions";

// Sanitize SVG markup to prevent XSS.
// Removes <script> blocks, event-handler attributes (on*),
// javascript: URLs, and <foreignObject> (arbitrary HTML embedding).
function sanitizeSVG(svg: string): string {
  return svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<foreignObject\b[^>]*\/>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(
      /(href|src|action|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*/gi,
      '$1=$2#'
    );
}

type CollectedAnswer = { question_id: string; student_answer: string };
type QuestionResult  = { question_id: string; is_correct: boolean; correct_answer: string };
type FinalResult = {
  score_pct:    number;
  correct:      number;
  total:        number;
  results:      QuestionResult[];
  badge_earned: boolean;
};

export default function ExerciseRunner({
  exercise,
  questions,
  backHref,
}: {
  exercise:  Exercise;
  questions: ExerciseQuestionPublic[];
  backHref:  string;
}) {
  const router = useRouter();
  const [i, setI]                 = useState(0);
  const [answer, setAnswer]       = useState<any>(null);
  const [checking, setChecking]   = useState(false);
  const [checkResult, setCheckResult] = useState<{ is_correct: boolean; correct_answer: string } | null>(null);
  const [collected, setCollected] = useState<CollectedAnswer[]>([]);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const q    = questions[i];
  // Boss rounds tag the originating game type in metadata.__game_type
  const game = (((q as any)?.metadata?.__game_type as GameType) ?? exercise.game_type) as GameType;

  function serialise(ans: any, g: GameType): string {
    return g === "word_type_sort" ? JSON.stringify(ans || {}) : String(ans ?? "").trim();
  }

  async function handleCheck() {
    setChecking(true);
    const serialised = serialise(answer, game);
    try {
      const result = await checkAnswer(q.id, serialised);
      setCheckResult(result);
    } catch {
      // Network error: mark unknown, still allow progression
      setCheckResult({ is_correct: false, correct_answer: "—" });
    } finally {
      setChecking(false);
    }
  }

  async function handleNext() {
    if (!checkResult) return;

    const serialised  = serialise(answer, game);
    const newCollected = [...collected, { question_id: q.id, student_answer: serialised }];
    setCollected(newCollected);
    setCheckResult(null);

    const nextQ: any      = questions[i + 1];
    const nextGame: string = nextQ?.metadata?.__game_type ?? exercise.game_type;
    setAnswer(nextGame === "word_type_sort" ? {} : null);

    if (i + 1 >= questions.length) {
      await handleFinish(newCollected);
    } else {
      setI(i + 1);
    }
  }

  async function handleFinish(finalAnswers: CollectedAnswer[]) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitExercise(exercise.id, finalAnswers);
      setFinalResult(result);
      router.refresh();
    } catch {
      setSubmitError(
        "Could not save your results — check your connection and try again. Your progress has not been recorded."
      );
      setSubmitting(false);
    }
  }

  // ── Empty exercise ────────────────────────────────────────────────────────
  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <p className="text-ink/70">This exercise has no questions yet.</p>
        <Link href={backHref} className="btn-ghost mt-4">Back to chapter</Link>
      </div>
    );
  }

  // ── Saving results (brief interstitial after last question) ───────────────
  if (submitting && !finalResult) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <p className="text-ink/60 text-sm">Saving your results…</p>
        {submitError && <p className="text-wine text-sm mt-3">{submitError}</p>}
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (finalResult) {
    const { score_pct, correct, total, results, badge_earned } = finalResult;
    const resultMap    = new Map(results.map((r) => [r.question_id, r]));
    // Look up by question_id not by index — router.refresh() can reorder the
    // questions prop after submission, making index-based lookup unreliable.
    const collectedMap = new Map(collected.map((c) => [c.question_id, c.student_answer]));

    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <div className="text-6xl mb-3">
          {score_pct >= 80 ? "🏆" : score_pct >= 50 ? "🌿" : "📜"}
        </div>
        <h2 className="text-2xl font-bold">{score_pct}%</h2>
        <p className="text-ink/70 mt-1">{correct} of {total} correct</p>

        {badge_earned && (
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
            🎖 <span className="font-semibold">Chapter badge earned!</span> You've mastered this chapter.
          </div>
        )}

        {submitError && (
          <p className="text-wine text-sm mt-3">{submitError}</p>
        )}

        <div className="flex gap-2 justify-center mt-6">
          <button
            className="btn-primary"
            onClick={() => {
              setI(0);
              setCollected([]);
              setFinalResult(null);
              setCheckResult(null);
              setSubmitError(null);
              const firstQ: any    = questions[0];
              const firstGame: string = firstQ?.metadata?.__game_type ?? exercise.game_type;
              setAnswer(firstGame === "word_type_sort" ? {} : null);
              if (exercise.is_boss) router.refresh();
            }}
          >
            Try again
          </button>
          <Link className="btn-ghost" href={backHref}>Back to chapter</Link>
        </div>

        {/* Per-question review — correct answers come from the server response */}
        <div className="mt-6 text-left">
          <h3 className="font-semibold mb-2 text-sm">Review</h3>
          <ol className="text-sm space-y-2">
            {questions.map((qq, idx) => {
              const r = resultMap.get(qq.id);
              return (
                <li
                  key={qq.id}
                  className={`p-2 rounded ${r?.is_correct ? "bg-olive/10" : "bg-wine/10"}`}
                >
                  <div className="text-xs text-ink/60">{idx + 1}. {qq.prompt}</div>
                  <div className="flex justify-between text-xs">
                    <span>
                      your answer:{" "}
                      <span className="font-mono">{collectedMap.get(qq.id) || "—"}</span>
                    </span>
                    <span>
                      expected:{" "}
                      <span className="font-mono">{r?.correct_answer ?? "—"}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  }

  // ── Active question ───────────────────────────────────────────────────────
  const isAnswerEmpty =
    answer === "" ||
    answer === null ||
    (game === "word_type_sort" && typeof answer === "object" && !Object.keys(answer ?? {}).length);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={backHref} className="text-sm text-ink/60 hover:underline">
        {"<- back to chapter"}
      </Link>

      <div className="card p-6 mt-3">
        <div className="flex items-center justify-between text-xs text-ink/60">
          <span>Question {i + 1} of {questions.length}</span>
          <span className="chip-sky">{exercise.title}</span>
        </div>
        <div className="mt-1 h-1.5 bg-ink/10 rounded">
          <div
            className="h-1.5 bg-wine rounded transition-all"
            style={{ width: `${(i / questions.length) * 100}%` }}
          />
        </div>

        <QuestionView
          q={q}
          game={game}
          answer={answer}
          setAnswer={setAnswer}
          locked={!!checkResult || checking}
        />

        <div className="mt-6 flex justify-end gap-2">
          {!checkResult ? (
            <button
              className="btn-primary"
              onClick={handleCheck}
              disabled={checking || isAnswerEmpty}
            >
              {checking ? "Checking…" : "Check"}
            </button>
          ) : (
            <>
              <FeedbackBadge ok={checkResult.is_correct} expected={checkResult.correct_answer} />
              <button className="btn-gold" onClick={handleNext}>
                {i + 1 >= questions.length ? "Finish" : "Next"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackBadge({ ok, expected }: { ok: boolean; expected: string }) {
  return (
    <span className={`chip ${ok ? "bg-olive/20 text-olive" : "bg-wine/20 text-wine"}`}>
      {ok ? "Correct" : (<>Expected: <span className="font-mono ml-1">{expected}</span></>)}
    </span>
  );
}

function QuestionView({
  q,
  game,
  answer,
  setAnswer,
  locked,
}: {
  q:         ExerciseQuestionPublic;
  game:      GameType;
  answer:    any;
  setAnswer: (v: any) => void;
  locked:    boolean;
}) {
  const opts: string[] = useMemo(() => {
    const raw = Array.isArray(q.options) ? [...q.options] : [];
    for (let j = raw.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [raw[j], raw[k]] = [raw[k], raw[j]];
    }
    return raw;
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === "word_type_sort") {
    const md  = (q.metadata ?? {}) as { words: { word: string; type: string }[]; types: string[] };
    const ans = (answer || {}) as Record<string, string>;
    return (
      <div className="mt-4">
        <p className="text-lg">{q.prompt}</p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {md.words?.map((w) => (
            <div
              key={w.word}
              className="flex items-center justify-between gap-3 p-2 rounded bg-ink/5 border border-ink/10"
            >
              <span className="font-medium">{w.word}</span>
              <select
                className="input w-44"
                value={ans[w.word] ?? ""}
                onChange={(e) => setAnswer({ ...ans, [w.word]: e.target.value })}
                disabled={locked}
              >
                <option value="" disabled>choose…</option>
                {md.types?.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (game === "preposition_picture") {
    const md = (q.metadata ?? {}) as { svg?: string; caption?: string };
    return (
      <div className="mt-4">
        <p className="text-lg">{q.prompt}</p>
        {md.svg && (
          <div className="mt-3 flex justify-center">
            <div
              className="rounded-lg p-3 border border-ink/10"
              dangerouslySetInnerHTML={{ __html: sanitizeSVG(md.svg) }}
              style={{ background: "#E5E7EB", color: "#0B1220" }}
            />
          </div>
        )}
        {md.caption && (
          <p className="text-xs text-ink/50 text-center mt-1">{md.caption}</p>
        )}
        <OptionGrid opts={opts} answer={answer} setAnswer={setAnswer} locked={locked} />
      </div>
    );
  }

  if (game === "translation") {
    return (
      <div className="mt-4">
        <p className="text-sm text-ink/60">Translate:</p>
        <p className="text-xl italic mt-1">{q.prompt}</p>
        <textarea
          className="input mt-3 min-h-[5rem]"
          placeholder="type your translation…"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={locked}
        />
      </div>
    );
  }

  if (game === "fill_gap" && !opts.length) {
    return (
      <div className="mt-4">
        <p className="text-lg">{q.prompt}</p>
        <input
          className="input mt-3"
          placeholder="type the missing word…"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={locked}
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-lg">{q.prompt}</p>
      <OptionGrid opts={opts} answer={answer} setAnswer={setAnswer} locked={locked} />
    </div>
  );
}

function OptionGrid({
  opts,
  answer,
  setAnswer,
  locked,
}: {
  opts:      string[];
  answer:    any;
  setAnswer: (v: any) => void;
  locked:    boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {opts.map((o, idx) => {
        const active = answer === o;
        return (
          <button
            key={idx}
            type="button"
            disabled={locked}
            onClick={() => setAnswer(o)}
            className={`text-left p-3 rounded-lg border transition ${
              active
                ? "border-sky bg-sky/15 text-sky"
                : "border-ink/15 bg-ink/5 hover:bg-ink/10"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
