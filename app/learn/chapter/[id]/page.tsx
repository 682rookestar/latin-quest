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
};

export default async function ChapterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: chapter }, { data: vocab }, { data: grammar }, { data: exercises }, { data: attempts }] = await Promise.all([
    supabase.from("chapters").select("*").eq("id", params.id).single(),
    supabase.from("vocab_items").select("*").eq("chapter_id", params.id).order("part_of_speech"),
    supabase.from("grammar_topics").select("*").eq("chapter_id", params.id),
    supabase.from("exercises").select("id, title, description, game_type, position").eq("chapter_id", params.id).order("position"),
    supabase.from("attempts").select("exercise_id, score_pct, completed_at").eq("student_id", user.id).not("completed_at","is",null),
  ]);

  if (!chapter) redirect("/learn");

  const bestScore: Record<string, number> = {};
  for (const a of (attempts ?? []) as any[]) {
    if (a.score_pct == null) continue;
    bestScore[a.exercise_id] = Math.max(bestScore[a.exercise_id] ?? 0, a.score_pct);
  }

  // group vocab by part of speech
  const grouped: Record<string, any[]> = {};
  for (const v of vocab ?? []) (grouped[v.part_of_speech ?? "other"] ??= []).push(v);

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

      <section>
        <h2 className="text-xl font-semibold mb-3">Exercises</h2>
        {!exercises?.length ? (
          <div className="card p-5 text-ink/60">
            <p>No exercises seeded for this chapter yet.</p>
            <p className="text-xs mt-2">A teacher account can add exercises (or seed scripts populate them).</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exercises.map((ex:any)=>{
              const best = bestScore[ex.id];
              return (
                <Link key={ex.id} href={`/learn/chapter/${params.id}/exercise/${ex.id}`} className="card p-4 hover:shadow-md transition block">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{GAME_ICONS[ex.game_type] ?? "🎯"}</div>
                    <span className="chip-sky">{GAME_LABELS[ex.game_type] ?? ex.game_type}</span>
                  </div>
                  <h3 className="font-semibold mt-2">{ex.title}</h3>
                  {ex.description && <p className="text-sm text-ink/60 mt-1 line-clamp-2">{ex.description}</p>}
                  {best != null && <p className="text-xs text-olive mt-2">best: {best}%</p>}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-2">Grammar topics</h3>
          {!grammar?.length ? (
            <p className="text-sm text-ink/60">No grammar topics listed.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {grammar.map((g:any)=>(
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
            {Object.entries(grouped).map(([pos, items])=>(
              <div key={pos}>
                <div className="text-xs uppercase tracking-wider text-ink/50">{pos}</div>
                <ul className="text-sm divide-y divide-ink/5">
                  {items.map((v:any)=>(
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
