import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GAME_LABELS: Record<string, string> = {
  vocab_match: "Vocab match",
  fill_gap: "Fill the gap",
  word_type_sort: "Word-type sort",
  tense_id: "Identify the tense",
  case_id: "Identify the case",
  adjective_agree: "Adjective agreement",
  adverb_use: "Adverb usage",
  preposition_picture: "Prepositions & pictures",
  translation: "Translation",
  multiple_choice: "Quick quiz",
  person_id: "Identify the person",
  conjugation_id: "Identify the conjugation",
  boss: "Boss round",
};

const GAME_ICONS: Record<string, string> = {
  vocab_match: "🔤",
  fill_gap: "✏️",
  word_type_sort: "🗂",
  tense_id: "⏳",
  case_id: "📐",
  adjective_agree: "🤝",
  adverb_use: "💨",
  preposition_picture: "🖼",
  translation: "📜",
  multiple_choice: "❓",
  boss: "👑",
};

export default async function ChapterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: chapter },
    { data: vocab },
    { data: grammar },
    { data: exercises },
    { data: attempts },
  ] = await Promise.all([
    supabase.from("chapters").select("*").eq("id", params.id).single(),
    supabase.from("vocab_items").select("*").eq("chapter_id", params.id).order("part_of_speech"),
    supabase.from("grammar_topics").select("*").eq("chapter_id", params.id),
    supabase.from("exercises").select("id, title, description, game_type, position, grammar_topic_id, is_boss").eq("chapter_id", params.id).order("position"),
    supabase.from("attempts").select("exercise_id, score_pct, completed_at").eq("student_id", user.id).not("completed_at","is",null),
  ]);

  if (!chapter) redirect("/learn");

  const bestScore: Record<string, number> = {};
  for (const a of (attempts ?? []) as any[]) {
    if (a.score_pct == null) continue;
    bestScore[a.exercise_id] = Math.max(bestScore[a.exercise_id] ?? 0, a.score_pct);
  }

  // Group vocab by part of speech
  const groupedVocab: Record<string, any[]> = {};
  for (const v of vocab ?? []) (groupedVocab[v.part_of_speech ?? "other"] ??= []).push(v);

  // Split exercises into boss + topic-tagged + general
  const allExercises = (exercises ?? []) as any[];
  const boss = allExercises.find(e => e.is_boss);
  const topicMap: Record<string, any[]> = {};
  const general: any[] = [];
  for (const e of allExercises) {
    if (e.is_boss) continue;
    if (e.grammar_topic_id) (topicMap[e.grammar_topic_id] ??= []).push(e);
    else general.push(e);
  }

  function ExerciseCard({ ex }: { ex: any }) {
    const best = bestScore[ex.id];
    return (
      <Link
        key={ex.id}
        href={`/learn/chapter/${params.id}/exercise/${ex.id}`}
        className="card p-4 hover:shadow-md transition block"
      >
        <div className="flex items-center justify-between">
          <div className="text-2xl">{GAME_ICONS[ex.game_type] ?? "🎯"}</div>
          <span className="chip-sky">{GAME_LABELS[ex.game_type] ?? ex.game_type}</span>
        </div>
        <h3 className="font-semibold mt-2">{ex.title}</h3>
        {ex.description && <p className="text-sm text-ink/60 mt-1 line-clamp-2">{ex.description}</p>}
        {best != null && <p className="text-xs text-olive mt-2">best: {best}%</p>}
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-baseline gap-3">
          <span className="chip-wine">Chapter {chapter.number}</span>
          <span className="text-xs text-ink/50">{chapter.subtitle}</span>
        </div>
        <h1 className="text-3xl font-bold mt-2">{chapter.title}</h1>
        <p className="text-ink/70 mt-1">{chapter.description}</p>
        {chapter.grammar_summary && (
          <p className="text-sm text-ink/60 mt-3 italic">{chapter.grammar_summary}</p>
        )}
      </header>

      {boss && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Boss round</h2>
          <Link
            href={`/learn/chapter/${params.id}/exercise/${boss.id}`}
            className="card p-5 hover:shadow-md transition block bg-gradient-to-r from-wine/10 to-gold/10 border-wine/30"
          >
            <div className="flex items-center justify-between">
              <div className="text-3xl">👑</div>
              <span className="chip-wine">{GAME_LABELS.boss}</span>
            </div>
            <h3 className="text-lg font-semibold mt-2">{boss.title}</h3>
            <p className="text-sm text-ink/70 mt-1">{boss.description}</p>
            {bestScore[boss.id] != null && <p className="text-xs text-olive mt-2">best: {bestScore[boss.id]}%</p>}
          </Link>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-3">By grammar topic</h2>
        {!grammar?.length ? (
          <p className="text-ink/60">No grammar topics listed.</p>
        ) : (
          <div className="space-y-6">
            {(grammar ?? []).map((g: any) => {
              const exs = topicMap[g.id] ?? [];
              return (
                <div key={g.id}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="chip-olive">{g.category}</span>
                    <h3 className="font-semibold">{g.name}</h3>
                    {!exs.length && <span className="text-xs text-ink/40">no exercise yet</span>}
                  </div>
                  {g.description && <p className="text-xs text-ink/60 mb-2 ml-1">{g.description}</p>}
                  {exs.length > 0 && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {exs.map((ex: any) => <ExerciseCard key={ex.id} ex={ex} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {general.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">General practice</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {general.map((ex: any) => <ExerciseCard key={ex.id} ex={ex} />)}
          </div>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-2">Grammar topics in this chapter</h3>
          {!grammar?.length ? (
            <p className="text-sm text-ink/60">No grammar topics listed.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {grammar.map((g: any) => (
                <li key={g.id}>
                  <span className="chip-olive mr-2">{g.category}</span>
                  <span className="font-medium">{g.name}</span>
                  {g.description && <div className="text-ink/60 text-xs ml-1">{g.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-2">Vocab list</h3>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-2">
            {Object.entries(groupedVocab).map(([pos, items]) => (
              <div key={pos}>
                <div className="text-xs uppercase tracking-wider text-ink/50">{pos}</div>
                <ul className="text-sm divide-y divide-ink/5">
                  {items.map((v: any) => (
                    <li key={v.id} className="py-1 flex items-center justify-between">
                      <span className="font-medium">{v.latin}</span>
                      <span className="text-ink/60 text-xs">{v.english}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
