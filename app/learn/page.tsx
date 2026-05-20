import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LearnHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }, { data: chapters }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
    supabase.from("class_members").select("classes(id, name, join_code)").eq("student_id", user.id),
    supabase.from("chapters").select("id, number, title, subtitle, description").order("number"),
    supabase.from("skill_progress").select("chapter_id, mastery").eq("student_id", user.id),
  ]);

  // Per-chapter avg mastery (0–5)
  const chapterAvg: Record<string, { sum: number; n: number }> = {};
  for (const p of (progress ?? []) as any[]) {
    chapterAvg[p.chapter_id] ??= { sum: 0, n: 0 };
    chapterAvg[p.chapter_id].sum += p.mastery;
    chapterAvg[p.chapter_id].n += 1;
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold">Welcome, {profile?.display_name}</h1>
        <p className="text-ink/60">Pick a chapter to keep practising, or join a class.</p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-2">Your classes</h2>
        {!memberships?.length ? (
          <p className="text-sm text-ink/60">You haven't joined any classes yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {memberships.map((m:any)=>(
              <li key={m.classes.id}>
                <span className="chip-gold mr-2">{m.classes.join_code}</span>
                {m.classes.name}
              </li>
            ))}
          </ul>
        )}
        <Link href="/learn/join" className="btn-ghost mt-3">Join a class</Link>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Chapters</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters?.map((ch:any)=>{
            const a = chapterAvg[ch.id];
            const m = a ? Math.round((a.sum / a.n) * 10) / 10 : 0;
            return (
              <Link key={ch.id} href={`/learn/chapter/${ch.id}`} className="card p-5 hover:shadow-md transition block">
                <div className="flex items-baseline justify-between">
                  <span className="chip-wine">Chapter {ch.number}</span>
                  <span className="text-xs text-ink/60">mastery {m}/5</span>
                </div>
                <h3 className="text-lg font-semibold mt-2">{ch.title}</h3>
                <p className="text-sm text-ink/70 mt-1 line-clamp-2">{ch.description}</p>
                <div className="mt-3 h-1.5 bg-ink/10 rounded">
                  <div className="h-1.5 bg-olive rounded" style={{ width: `${(m/5)*100}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
