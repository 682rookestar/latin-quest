import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/PageHero";
import ChapterStandard from "@/components/ChapterStandard";
import ClassLeaderboard from "@/components/ClassLeaderboard";

export default async function LearnHome({
  searchParams,
}: {
  searchParams?: { locked?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: memberships },
    { data: chapters },
    { data: lockedRows },
    { data: standardProgress },
    { data: leaderboard },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
    supabase.from("class_members").select("classes(id, name, join_code)").eq("student_id", user.id),
    supabase.from("chapters").select("id, number, title, subtitle, description").order("number"),
    supabase.rpc("locked_chapters_for_me"),
    supabase.rpc("get_standard_progress"),
    supabase.rpc("get_class_leaderboard"),
  ]);

  const lockedChapterIds = new Set(
    ((lockedRows as any[]) ?? []).map((r) => r.chapter_id)
  );

  // Build a lookup map: chapter_id → progress row
  const progressMap: Record<string, {
    chapter_number: number;
    total_topics: number;
    passed_topics: number;
    badge_earned: boolean;
  }> = {};
  for (const row of ((standardProgress as any[]) ?? [])) {
    progressMap[row.chapter_id] = row;
  }

  return (
    <div className="space-y-8">
      <PageHero
        latinTag="Discipulus"
        title={`Salve, ${profile?.display_name ?? "discipule"}`}
        subtitle="Pick a chapter to keep practising, or join a class to compete with your cohort."
        variant="legionary"
      />
      {searchParams?.locked === "1" && (
        <p className="-mt-4 text-sm text-wine bg-wine/5 border border-wine/20 rounded p-3">
          That chapter is currently locked by your teacher. Try another, or check back later.
        </p>
      )}

      {/* Two-column layout: leaderboard left, content right */}
      <div className="flex gap-6 items-start">

        {/* ── Left sidebar: leaderboard ── */}
        <div className="hidden lg:block w-52 flex-shrink-0 sticky top-20">
          <ClassLeaderboard rows={(leaderboard as any[]) ?? []} />

          {/* Classes / join */}
          <div className="card p-4 mt-4">
            <h2 className="h-display text-xs tracking-widest text-gold mb-2">Your Classes</h2>
            {!memberships?.length ? (
              <p className="text-xs text-ink/50">No classes yet.</p>
            ) : (
              <ul className="text-xs space-y-1 mb-2">
                {memberships.map((m: any) => (
                  <li key={m.classes.id} className="flex items-center gap-2">
                    <span className="chip-gold text-[10px] px-1.5 py-0.5">{m.classes.join_code}</span>
                    <span className="truncate text-white/70">{m.classes.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/learn/join" className="text-xs text-gold/70 hover:text-gold transition-colors">
              + Join a class
            </Link>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile: classes card */}
          <div className="lg:hidden card p-5">
            <h2 className="font-semibold mb-2">Your classes</h2>
            {!memberships?.length ? (
              <p className="text-sm text-ink/60">You haven't joined any classes yet.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {memberships.map((m: any) => (
                  <li key={m.classes.id}>
                    <span className="chip-gold mr-2">{m.classes.join_code}</span>
                    {m.classes.name}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/learn/join" className="btn-ghost mt-3">Join a class</Link>
          </div>

          <section>
            <h2 className="h-display text-2xl mb-4">Chapters</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {chapters?.map((ch: any) => {
            const p = progressMap[ch.id];
            const totalTopics  = p?.total_topics  ?? 0;
            const passedTopics = p?.passed_topics ?? 0;
            const badgeEarned  = p?.badge_earned  ?? false;
            const locked = lockedChapterIds.has(ch.id);

            const inner = (
              <div className="flex gap-4 items-start">
                {/* Roman standard */}
                <div className="flex-shrink-0 flex flex-col items-center pt-1">
                  <ChapterStandard
                    chapterNumber={ch.number}
                    totalTopics={totalTopics}
                    passedTopics={passedTopics}
                    badgeEarned={badgeEarned}
                    size={130}
                  />
                </div>

                {/* Chapter info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="chip-wine">Chapter {ch.number}</span>
                    {locked ? (
                      <span className="text-xs text-wine">🔒 Locked</span>
                    ) : badgeEarned ? (
                      <span className="text-xs text-gold" title="All topics mastered">🎖 Mastered</span>
                    ) : totalTopics > 0 ? (
                      <span className="text-xs text-ink/60">{passedTopics}/{totalTopics} topics</span>
                    ) : null}
                  </div>
                  <h3 className="text-lg font-semibold mt-2 leading-tight">{ch.title}</h3>
                  <p className="text-sm text-ink/70 mt-1 line-clamp-2">{ch.description}</p>

                  {/* Progress bar */}
                  {totalTopics > 0 && (
                    <div className="mt-3 h-1.5 bg-ink/10 rounded">
                      <div
                        className={`h-1.5 rounded transition-all ${badgeEarned ? "bg-gold" : "bg-olive"}`}
                        style={{ width: `${(passedTopics / totalTopics) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );

            return locked ? (
              <div
                key={ch.id}
                className="card p-5 block opacity-50 cursor-not-allowed grayscale select-none"
                aria-disabled="true"
                title="Locked by your teacher"
              >
                {inner}
              </div>
            ) : (
              <Link
                key={ch.id}
                href={`/learn/chapter/${ch.id}`}
                className="card p-5 hover:shadow-md transition block"
              >
                {inner}
              </Link>
            );
          })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
