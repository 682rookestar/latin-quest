"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, ExerciseQuestion, GameType } from "@/lib/types";

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

// Strip Latin macrons / diacritics for lenient comparison.
// Uses ̀-ͯ (combining diacritical marks block) for portability.
function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eqLoose(student: string, correct: string): boolean {
  return strip(student) === strip(correct);
}

// Reduce a word to an approximate stem by stripping common English suffixes.
// Handles walks/walking/walked, runs/running, etc. without a full NLP library.
function stemWord(w: string): string {
  return w
    .replace(/(?:ing|tion|ness|ment)$/, "")
    .replace(/(?:ed|er|est|ly)$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "")
    .replace(/e$/, "");
}

function translationOk(student: string, correct: string): boolean {
  const a = strip(student);
  const b = strip(correct);
  if (!a) return false;
  if (a === b) return true;

  const studentWords = a.split(" ");
  const correctKeywords = b.split(" ").filter((w) => w.length > 3);

  // Must be at least half the length of the expected answer (stops single-word tricks).
  if (studentWords.length < Math.ceil(correctKeywords.length * 0.5)) return false;

  // Must have reasonable word variety (stops "the the the the" tricks).
  const uniqueRatio = new Set(studentWords).size / studentWords.length;
  if (studentWords.length > 3 && uniqueRatio < 0.6) return false;

  // Stem-match keywords so "walks"/"walking"/"walked" all match each other.
  const studentStems = new Set(studentWords.map(stemWord));
  const hits = correctKeywords.filter((w) => studentStems.has(stemWord(w))).length;
  return correctKeywords.length > 0 && hits / correctKeywords.length >= 0.8;
}

export default function ExerciseRunner({
  exercise,
  questions,
  backHref,
}: {
  exercise: Exercise;
  questions: ExerciseQuestion[];
  backHref: string;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<any>("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; student: string }[]>([]);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBadge, setNewBadge] = useState(false);

  const q = questions[i];
  // Boss rounds carry the source game type per-question via metadata.__game_type.
  const game: GameType = (((q as any)?.metadata?.__game_type as GameType) ??
    exercise.game_type) as GameType;

  function check(): { ok: boolean; studentText: string } {
    const correct = q.correct_answer ?? "";
    if (game === "word_type_sort") {
      const md = q.metadata as { words: { word: string; type: string }[] } | null;
      const items = md?.words ?? [];
      const studentObj = (answer || {}) as Record<string, string>;
      const ok = items.every((it) => studentObj[it.word] === it.type);
      return { ok, studentText: JSON.stringify(studentObj) };
    }
    const s = String(answer ?? "").trim();
    if (game === "translation") return { ok: translationOk(s, correct), studentText: s };
    return { ok: eqLoose(s, correct), studentText: s };
  }

  function next() {
    const r = check();
    const newResults = [...results, { correct: r.ok, student: r.studentText }];
    setResults(newResults);
    setSubmitted(false);

    // Boss rounds switch game type per question, so reset the answer based on
    // the NEXT question's effective game type.
    const nextQ: any = questions[i + 1];
    const nextGame: string = nextQ?.metadata?.__game_type ?? exercise.game_type;
    setAnswer(nextGame === "word_type_sort" ? {} : "");

    if (i + 1 >= questions.length) {
      finish(newResults);
    } else {
      setI(i + 1);
    }
  }

  async function finish(final: { correct: boolean; student: string }[]) {
    setDone(true);
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const correctCount = final.filter((r) => r.correct).length;
    const total = final.length;
    const pct = Math.round((correctCount / Math.max(1, total)) * 100);

    const { data: attempt, error: aErr } = await supabase
      .from("attempts")
      .insert({
        student_id: user.id,
        exercise_id: exercise.id,
        completed_at: new Date().toISOString(),
        score_pct: pct,
        total_questions: total,
        correct_questions: correctCount,
      })
      .select("id")
      .single();

    if (!aErr && attempt) {
      const rows = final.map((r, idx) => ({
        attempt_id: attempt.id,
        question_id: questions[idx].id,
        student_answer: r.student,
        is_correct: r.correct,
      }));
      await supabase.from("attempt_answers").insert(rows);
    }

    // Skill progress rollup. For a normal exercise all answers map to the
    // exercise's own skill; for a boss round we bucket by source skill.
    const buckets: Record<string, { attempts: number; correct: number }> = {};
    final.forEach((r, idx) => {
      const qMd: any = (questions[idx] as any)?.metadata ?? {};
      const skillId: string | null = qMd.__skill_id ?? exercise.skill_id ?? null;
      if (!skillId) return;
      buckets[skillId] ??= { attempts: 0, correct: 0 };
      buckets[skillId].attempts += 1;
      if (r.correct) buckets[skillId].correct += 1;
    });

    for (const [skillId, agg] of Object.entries(buckets)) {
      await supabase.rpc("upsert_skill_progress", {
        p_student: user.id,
        p_chapter: exercise.chapter_id,
        p_skill: skillId,
        p_attempts: agg.attempts,
        p_correct: agg.correct,
      });
    }

    // Award chapter badge if mastery threshold is met.
    // Logic lives in a security-definer RPC so the threshold
    // cannot be bypassed via direct API calls.
    const { data: badgeAwarded } = await supabase
      .rpc("award_chapter_badge_if_earned", { p_chapter: exercise.chapter_id });
    if (badgeAwarded) setNewBadge(true);

    setSaving(false);
    router.refresh();
  }

  if (!questions.length) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <p className="text-ink/70">This exercise has no questions yet.</p>
        <Link href={backHref} className="btn-ghost mt-4">Back to chapter</Link>
      </div>
    );
  }

  if (done) {
    const correctN = results.filter((r) => r.correct).length;
    const pct = Math.round((correctN / results.length) * 100);
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <div className="text-6xl mb-3">{pct >= 80 ? "🏆" : pct >= 50 ? "🌿" : "📜"}</div>
        <h2 className="text-2xl font-bold">{pct}%</h2>
        <p className="text-ink/70 mt-1">{correctN} of {results.length} correct</p>
        {saving && <p className="text-xs text-ink/50 mt-2">saving progress...</p>}
        {newBadge && (
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
            🎖 <span className="font-semibold">Chapter badge earned!</span> You've mastered this chapter.
          </div>
        )}
        <div className="flex gap-2 justify-center mt-6">
          <button
            className="btn-primary"
            onClick={() => {
              setI(0);
              setResults([]);
              setDone(false);
              const firstQ: any = questions[0];
              const firstGame: string =
                firstQ?.metadata?.__game_type ?? exercise.game_type;
              setAnswer(firstGame === "word_type_sort" ? {} : "");
              if (exercise.is_boss) router.refresh();
            }}
          >
            Try again
          </button>
          <Link className="btn-ghost" href={backHref}>Back to chapter</Link>
        </div>
        <div className="mt-6 text-left">
          <h3 className="font-semibold mb-2 text-sm">Review</h3>
          <ol className="text-sm space-y-2">
            {questions.map((qq, idx) => (
              <li
                key={qq.id}
                className={`p-2 rounded ${results[idx]?.correct ? "bg-olive/10" : "bg-wine/10"}`}
              >
                <div className="text-xs text-ink/60">{idx + 1}. {qq.prompt}</div>
                <div className="flex justify-between text-xs">
                  <span>your answer: <span className="font-mono">{results[idx]?.student || "-"}</span></span>
                  <span>expected: <span className="font-mono">{qq.correct_answer}</span></span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={backHref} className="text-sm text-ink/60 hover:underline">{"<- back to chapter"}</Link>
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
          submitted={submitted}
        />

        <div className="mt-6 flex justify-end gap-2">
          {!submitted ? (
            <button
              className="btn-primary"
              onClick={() => setSubmitted(true)}
              disabled={
                answer === "" ||
                answer === null ||
                (typeof answer === "object" &&
                  !Object.keys(answer ?? {}).length &&
                  game === "word_type_sort")
              }
            >
              Check
            </button>
          ) : (
            <>
              <FeedbackBadge ok={check().ok} expected={q.correct_answer} />
              <button className="btn-gold" onClick={next}>
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
  submitted,
}: {
  q: ExerciseQuestion;
  game: GameType;
  answer: any;
  setAnswer: (v: any) => void;
  submitted: boolean;
}) {
  const opts: string[] = useMemo(() => {
    const raw = Array.isArray(q.options) ? [...q.options] : [];
    for (let i = raw.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [raw[i], raw[j]] = [raw[j], raw[i]];
    }
    return raw;
  }, [q.id]);

  if (game === "word_type_sort") {
    const md = (q.metadata ?? {}) as {
      words: { word: string; type: string }[];
      types: string[];
    };
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
                disabled={submitted}
              >
                <option value="" disabled>
                  choose...
                </option>
                {md.types?.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
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
        <OptionGrid opts={opts} answer={answer} setAnswer={setAnswer} submitted={submitted} />
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
          placeholder="type your translation..."
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
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
          placeholder="type the missing word..."
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-lg">{q.prompt}</p>
      <OptionGrid opts={opts} answer={answer} setAnswer={setAnswer} submitted={submitted} />
    </div>
  );
}

function OptionGrid({
  opts,
  answer,
  setAnswer,
  submitted,
}: {
  opts: string[];
  answer: any;
  setAnswer: (v: any) => void;
  submitted: boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {opts.map((o) => {
        const active = answer === o;
        return (
          <button
            key={o}
            type="button"
            disabled={submitted}
            onClick={() => setAnswer(o)}
            className={`text-left p-3 rounded-lg border transition ${
              active ? "border-sky bg-sky/15 text-sky" : "border-ink/15 bg-ink/5 hover:bg-ink/10"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
