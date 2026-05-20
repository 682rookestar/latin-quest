"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, ExerciseQuestion, GameType } from "@/lib/types";

const macron = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function strip(s: string) {
  return macron(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Lenient compare for translation answers
function translationOk(student: string, correct: string) {
  const a = strip(student);
  const b = strip(correct);
  if (!a) return false;
  if (a === b) return true;
  // accept if all major content words present (>3 letters)
  const need = b.split(" ").filter(w => w.length > 3);
  const got  = new Set(a.split(" "));
  const hits = need.filter(w => got.has(w)).length;
  return need.length > 0 && hits / need.length >= 0.7;
}

function eqLoose(student: string, correct: string) {
  return strip(student) === strip(correct);
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

  const q = questions[i];
  const game: GameType = exercise.game_type;

  function check(): { ok: boolean; studentText: string } {
    const correct = q.correct_answer ?? "";
    if (game === "word_type_sort") {
      // answer is { [word]: type }
      const md = q.metadata as { words: { word: string; type: string }[] } | null;
      const items = md?.words ?? [];
      const studentObj = (answer || {}) as Record<string, string>;
      const all = items.every(it => studentObj[it.word] === it.type);
      return { ok: all, studentText: JSON.stringify(studentObj) };
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
    setAnswer(game === "word_type_sort" ? {} : "");
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
    if (!user) { setSaving(false); return; }
    const correctCount = final.filter(r => r.correct).length;
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
    if (exercise.skill_id) {
      await supabase.rpc("upsert_skill_progress", {
        p_student: user.id,
        p_chapter: exercise.chapter_id,
        p_skill: exercise.skill_id,
        p_attempts: total,
        p_correct: correctCount,
      });
    }
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
    const correctN = results.filter(r => r.correct).length;
    const pct = Math.round((correctN / results.length) * 100);
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <div className="text-6xl mb-3">{pct >= 80 ? "🏆" : pct >= 50 ? "🌿" : "📜"}</div>
        <h2 className="text-2xl font-bold">{pct}%</h2>
        <p className="text-ink/70 mt-1">{correctN} of {results.length} correct</p>
        {saving && <p className="text-xs text-ink/50 mt-2">saving progress…</p>}
        <div className="flex gap-2 justify-center mt-6">
          <button className="btn-primary" onClick={()=>{ setI(0); setResults([]); setDone(false); setAnswer(game==='word_type_sort'?{}:""); }}>Try again</button>
          <Link className="btn-ghost" href={backHref}>Back to chapter</Link>
        </div>
        <div className="mt-6 text-left">
          <h3 className="font-semibold mb-2 text-sm">Review</h3>
          <ol className="text-sm space-y-2">
            {questions.map((qq, idx) => (
              <li key={qq.id} className={`p-2 rounded ${results[idx]?.correct ? "bg-olive/10" : "bg-wine/10"}`}>
                <div className="text-xs text-ink/60">{idx+1}. {qq.prompt}</div>
                <div className="flex justify-between text-xs">
                  <span>your answer: <span className="font-mono">{results[idx]?.student || "—"}</span></span>
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
      <Link href={backHref} className="text-sm text-ink/60 hover:underline">← back to chapter</Link>
      <div className="card p-6 mt-3">
        <div className="flex items-center justify-between text-xs text-ink/60">
          <span>Question {i+1} of {questions.length}</span>
          <span className="chip-sky">{exercise.title}</span>
        </div>
        <div className="mt-1 h-1.5 bg-ink/10 rounded">
          <div className="h-1.5 bg-wine rounded transition-all" style={{ width: `${((i)/questions.length)*100}%` }} />
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
              disabled={answer === "" || answer === null || (typeof answer === "object" && !Object.keys(answer ?? {}).length && game === "word_type_sort")}
            >
              Check
            </button>
          ) : (
            <>
              <FeedbackBadge ok={check().ok} expected={q.correct_answer} />
              <button className="btn-gold" onClick={next}>
                {i + 1 >= questions.length ? "Finish" : "Next →"}
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
      {ok ? "✓ Correct" : <>✗ Expected: <span className="font-mono ml-1">{expected}</span></>}
    </span>
  );
}

function QuestionView({
  q, game, answer, setAnswer, submitted,
}: {
  q: ExerciseQuestion;
  game: GameType;
  answer: any;
  setAnswer: (v: any) => void;
  submitted: boolean;
}) {
  const opts: string[] = useMemo(() => (Array.isArray(q.options) ? q.options : []), [q]);

  if (game === "word_type_sort") {
    const md = (q.metadata ?? {}) as { words: { word: string; type: string }[]; types: string[] };
    const ans = (answer || {}) as Record<string, string>;
    return (
      <div className="mt-4">
        <p className="text-lg">{q.prompt}</p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {md.words?.map(w => (
            <div key={w.word} className="flex items-center justify-between gap-3 p-2 rounded bg-white/60 border border-ink/10">
              <span className="font-medium">{w.word}</span>
              <select
                className="input w-44"
                value={ans[w.word] ?? ""}
                onChange={(e) => setAnswer({ ...ans, [w.word]: e.target.value })}
                disabled={submitted}
              >
                <option value="" disabled>choose…</option>
                {md.types?.map(t => <option key={t} value={t}>{t}</option>)}
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
            <div className="bg-white/70 rounded-lg p-3 border border-ink/10"
                 dangerouslySetInnerHTML={{ __html: md.svg }} />
          </div>
        )}
        {md.caption && <p className="text-xs text-ink/50 text-center mt-1">{md.caption}</p>}
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
          placeholder="type your translation…"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
        />
      </div>
    );
  }

  if (game === "fill_gap" && !opts.length) {
    // free-text fill
    return (
      <div className="mt-4">
        <p className="text-lg">{q.prompt}</p>
        <input
          className="input mt-3"
          placeholder="type the missing word…"
          value={answer || ""}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
        />
      </div>
    );
  }

  // Default: prompt + options
  return (
    <div className="mt-4">
      <p className="text-lg">{q.prompt}</p>
      <OptionGrid opts={opts} answer={answer} setAnswer={setAnswer} submitted={submitted} />
    </div>
  );
}

function OptionGrid({ opts, answer, setAnswer, submitted }: { opts: string[]; answer: any; setAnswer: (v:any)=>void; submitted: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {opts.map(o => {
        const active = answer === o;
        return (
          <button
            key={o}
            type="button"
            disabled={submitted}
            onClick={() => setAnswer(o)}
            className={`text-left p-3 rounded-lg border transition ${active ? "border-wine bg-wine/10" : "border-ink/15 bg-white/60 hover:bg-white"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
