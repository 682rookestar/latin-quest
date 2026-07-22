import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MASTERY_COLORS = [
  "bg-ink/5",
  "bg-wine/15",
  "bg-wine/30",
  "bg-gold/40",
  "bg-olive/50",
  "bg-olive/70",
];

function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default async function StudentDetail({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pupil records are limited to classes owned by the signed-in teacher.
  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (teacherProfile?.role !== "teacher") redirect("/learn");

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, teacher_id, profiles!classes_teacher_id_fkey(display_name, email)")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();
  if (!klass) redirect("/teacher");

  // Verify student is in this class (and grab their profile)
  const { data: membership } = await supabase
    .from("class_members")
    .select("student_id, profiles(id, display_name, email)")
    .eq("class_id", id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!membership) redirect(`/teacher/classes/${id}`);

  const profile: any = Array.isArray((membership as any).profiles)
    ? (membership as any).profiles[0]
    : (membership as any).profiles;

  const [{ data: chapters }, { data: skills }, { data: progress }, { data: attempts }] = await Promise.all([
    supabase.from("chapters").select("id, number, title").order("number"),
    supabase.from("skills").select("id, code, display_name").order("display_name"),
    supabase
      .from("skill_progress")
      .select("chapter_id, skill_id, attempts, correct, mastery, last_attempted_at")
      .eq("student_id", studentId),
    supabase
      .from("attempts")
      .select("id, exercise_id, score_pct, started_at, completed_at, total_questions, correct_questions, exercises(title, chapter_id, game_type, chapters(number, title))")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);

  // Mastery lookup
  const pmap: Record<string, Record<string, number>> = {};
  const aggSkill: Record<string, { attempts: number; correct: number }> = {};
  const aggChapter: Record<string, { attempts: number; correct: number }> = {};
  for (const row of (progress ?? []) as any[]) {
    pmap[row.chapter_id] ??= {};
    pmap[row.chapter_id][row.skill_id] = row.mastery;
    aggSkill[row.skill_id] ??= { attempts: 0, correct: 0 };
    aggSkill[row.skill_id].attempts += row.attempts;
    aggSkill[row.skill_id].correct += row.correct;
    aggChapter[row.chapter_id] ??= { attempts: 0, correct: 0 };
    aggChapter[row.chapter_id].attempts += row.attempts;
    aggChapter[row.chapter_id].correct += row.correct;
  }

  const totalAttempts = (attempts ?? []).length;
  const avg = totalAttempts
    ? Math.round(((attempts ?? []) as any[]).reduce((s, a) => s + (a.score_pct ?? 0), 0) / totalAttempts)
    : 0;

  return (
    <div className="space-y-8">
      <Link href={`/teacher/classes/${id}`} className="text-sm text-ink/60 hover:underline">
        &lsaquo; back to {klass.name}
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="h-display text-sky text-xs tracking-[0.3em] mb-1">Discipulus</p>
          <h1 className="h-display text-3xl">{profile?.display_name ?? profile?.email}</h1>
          <p className="text-sm text-ink/60">{profile?.email}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="chip-wine">{totalAttempts} attempt{totalAttempts === 1 ? "" : "s"}</span>
            {totalAttempts > 0 && <span className="chip-olive">avg {avg}%</span>}
          </div>
        </div>
        <a
          href={`/teacher/classes/${id}/export?student=${studentId}`}
          className="btn-gold whitespace-nowrap"
          download
        >
          Export to Excel
        </a>
      </header>

      <section>
        <h2 className="h-display text-xl mb-3">Mastery by chapter and skill</h2>
        <div className="overflow-x-auto card p-3">
          <table className="text-sm border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left p-2">Chapter</th>
                {(skills ?? []).map((sk: any) => (
                  <th key={sk.id} className="text-[10px] p-0 align-bottom whitespace-nowrap">
                    <div className="rotate-[-60deg] origin-bottom-left translate-y-2 inline-block max-w-[2.5rem] text-ink/60">
                      {sk.display_name}
                    </div>
                  </th>
                ))}
                <th className="p-2 text-xs text-ink/60">chapter %</th>
              </tr>
            </thead>
            <tbody>
              {(chapters ?? []).map((ch: any) => {
                const agg = aggChapter[ch.id];
                const pct = agg && agg.attempts ? Math.round((agg.correct / agg.attempts) * 100) : null;
                return (
                  <tr key={ch.id}>
                    <td className="p-2 whitespace-nowrap">Ch {ch.number}: {ch.title}</td>
                    {(skills ?? []).map((sk: any) => {
                      const lvl = pmap[ch.id]?.[sk.id] ?? 0;
                      return (
                        <td key={ch.id + sk.id} className="p-0">
                          <div
                            title={`${sk.display_name} - Ch ${ch.number} - mastery ${lvl}/5`}
                            className={`mastery-cell ${MASTERY_COLORS[Math.min(5, Math.max(0, lvl))]}`}
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-xs text-ink/60">{pct != null ? `${pct}%` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Per-skill totals</h2>
        <div className="card divide-y divide-ink/10">
          {(skills ?? []).map((sk: any) => {
            const agg = aggSkill[sk.id];
            if (!agg) {
              return (
                <div key={sk.id} className="p-3 flex justify-between items-center">
                  <span className="font-medium">{sk.display_name}</span>
                  <span className="text-xs text-ink/40">not attempted</span>
                </div>
              );
            }
            const pct = agg.attempts ? Math.round((agg.correct / agg.attempts) * 100) : 0;
            return (
              <div key={sk.id} className="p-3 flex justify-between items-center">
                <span className="font-medium">{sk.display_name}</span>
                <div className="text-sm flex items-center gap-4">
                  <span className="font-mono text-ink/70">{agg.correct}/{agg.attempts}</span>
                  <span className="chip-olive">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">All attempts</h2>
        {!attempts?.length ? (
          <p className="text-ink/60">No attempts yet.</p>
        ) : (
          <div className="card divide-y divide-ink/10 max-h-[36rem] overflow-y-auto">
            {((attempts ?? []) as any[]).map((a) => {
              const ex: any = Array.isArray(a.exercises) ? a.exercises[0] : a.exercises;
              const chap: any = ex && (Array.isArray(ex.chapters) ? ex.chapters[0] : ex.chapters);
              return (
                <div key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{ex?.title ?? "(deleted exercise)"}</div>
                    <div className="text-xs text-ink/60">
                      {chap ? `Ch ${chap.number}: ${chap.title}` : ""} &middot; {fmtDate(a.completed_at)}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="font-mono">{a.correct_questions}/{a.total_questions}</span>
                    <span className="ml-3 chip-olive">{a.score_pct ?? 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
