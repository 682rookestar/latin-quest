import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rotateJoinCode, setChapterLock } from "@/app/teacher/actions";

const MASTERY_COLORS = [
  "bg-ink/5",
  "bg-wine/15",
  "bg-wine/30",
  "bg-gold/40",
  "bg-olive/50",
  "bg-olive/70",
];

export default async function ClassDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "teacher") redirect("/learn");

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, join_code, join_code_expires_at, teacher_id, profiles!classes_teacher_id_fkey(display_name, email)")
    .eq("id", params.id)
    .single();
  if (!klass) redirect("/teacher");
  const isOwner = klass.teacher_id === user.id;
  const codeExpiresAt: string | null = (klass as any).join_code_expires_at ?? null;
  const codeExpired = codeExpiresAt ? new Date(codeExpiresAt).getTime() < Date.now() : false;
  const ownerProfile: any = Array.isArray((klass as any).profiles)
    ? (klass as any).profiles[0]
    : (klass as any).profiles;
  const ownerName = ownerProfile?.display_name ?? ownerProfile?.email ?? "Unknown";

  const [{ data: members }, { data: chapters }, { data: skills }, { data: progress }, { data: attempts }, { data: lockedRows }] = await Promise.all([
    supabase
      .from("class_members")
      .select("student_id, profiles(id, display_name, email)")
      .eq("class_id", params.id),
    supabase.from("chapters").select("id, number, title").order("number"),
    supabase.from("skills").select("id, code, display_name").order("display_name"),
    supabase
      .from("skill_progress")
      .select("student_id, chapter_id, skill_id, attempts, correct, mastery"),
    supabase
      .from("attempts")
      .select("id, student_id, exercise_id, score_pct, completed_at, total_questions, correct_questions, exercises(title, chapter_id)")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("class_chapter_locks")
      .select("chapter_id")
      .eq("class_id", params.id),
  ]);

  const lockedChapterIds = new Set(
    ((lockedRows as any[]) ?? []).map((r) => r.chapter_id)
  );

  const studentIds = new Set((members ?? []).map((m: any) => m.student_id));
  const myProgress = (progress ?? []).filter((p: any) => studentIds.has(p.student_id));
  const myAttempts = (attempts ?? []).filter((a: any) => studentIds.has(a.student_id));

  const pmap: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of myProgress as any[]) {
    pmap[row.student_id] ??= {};
    pmap[row.student_id][row.chapter_id] ??= {};
    pmap[row.student_id][row.chapter_id][row.skill_id] = row.mastery;
  }

  // Per-student attempt totals for the roster
  const attemptCount: Record<string, number> = {};
  const avgScore: Record<string, { sum: number; n: number }> = {};
  for (const a of (await supabase
    .from("attempts")
    .select("student_id, score_pct")
    .in("student_id", [...studentIds])
    .not("completed_at", "is", null)).data ?? []) {
    const sid = (a as any).student_id;
    attemptCount[sid] = (attemptCount[sid] ?? 0) + 1;
    avgScore[sid] ??= { sum: 0, n: 0 };
    if ((a as any).score_pct != null) {
      avgScore[sid].sum += (a as any).score_pct;
      avgScore[sid].n += 1;
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="h-display text-sky text-xs tracking-[0.3em] mb-1">Class</p>
          <h1 className="h-display text-3xl">{klass.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`chip-gold ${codeExpired ? "opacity-60" : ""}`}>
              Join code: <span className="font-mono ml-1">{klass.join_code}</span>
            </span>
            {codeExpiresAt && (
              <span className={`text-xs ${codeExpired ? "text-wine" : "text-ink/60"}`}>
                {codeExpired ? "expired " : "expires "}
                {new Date(codeExpiresAt).toLocaleDateString()}
              </span>
            )}
            <span className="text-sm text-ink/60">{members?.length ?? 0} student{members?.length === 1 ? "" : "s"}</span>
            {!isOwner && (
              <span className="chip-wine">View only &middot; teacher: {ownerName}</span>
            )}
            {isOwner && (
              <form action={rotateJoinCode}>
                <input type="hidden" name="class_id" value={klass.id} />
                <button className="btn-ghost text-xs" type="submit">
                  Rotate code
                </button>
              </form>
            )}
          </div>
          <p className="text-sm text-ink/60 mt-2">
            {isOwner ? (
              <>Share the join code with your students &mdash; they enter it at <code>/learn/join</code>. Rotate it whenever you need to revoke access.</>
            ) : (
              <>You are viewing another teacher&apos;s class. Only {ownerName} can edit or delete it.</>
            )}
          </p>
        </div>
        <a
          href={`/teacher/classes/${klass.id}/export`}
          className="btn-gold whitespace-nowrap"
          download
        >
          Export to Excel
        </a>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-1">Chapter access</h2>
        <p className="text-sm text-ink/60 mb-3">
          {isOwner
            ? "Toggle a chapter Locked to hide it from your students on /learn. Open by default."
            : `View only — only ${ownerName} can change locks for this class.`}
        </p>
        <div className="card p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {chapters?.map((ch: any) => {
            const locked = lockedChapterIds.has(ch.id);
            return (
              <form
                key={ch.id}
                action={setChapterLock}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded border ${
                  locked ? "border-wine/40 bg-wine/5" : "border-ink/10"
                }`}
              >
                <div>
                  <div className="text-xs text-ink/60">Chapter {ch.number}</div>
                  <div className="font-medium text-sm">{ch.title}</div>
                </div>
                <input type="hidden" name="class_id" value={klass.id} />
                <input type="hidden" name="chapter_id" value={ch.id} />
                <input type="hidden" name="locked" value={locked ? "0" : "1"} />
                <button
                  type="submit"
                  disabled={!isOwner}
                  className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    locked
                      ? "bg-wine text-parchment hover:bg-wine/90"
                      : "bg-ink/10 hover:bg-ink/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {locked ? "Locked" : "Open"}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Students</h2>
        {!members?.length ? (
          <p className="text-ink/60">No students yet. Once they join with the code, they will appear here.</p>
        ) : (
          <div className="card divide-y divide-ink/10">
            {(members as any[]).map((m) => {
              const p: any = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              const name = p?.display_name ?? p?.email ?? "Unknown";
              const sid = m.student_id;
              const att = attemptCount[sid] ?? 0;
              const avg = avgScore[sid]?.n ? Math.round(avgScore[sid].sum / avgScore[sid].n) : null;
              return (
                <Link
                  key={sid}
                  href={`/teacher/classes/${klass.id}/students/${sid}`}
                  className="block p-3 hover:bg-ink/5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-ink/60">{p?.email}</div>
                  </div>
                  <div className="text-sm flex items-center gap-4">
                    <span className="text-ink/60">{att} attempt{att === 1 ? "" : "s"}</span>
                    {avg != null && <span className="chip-olive">avg {avg}%</span>}
                    <span className="text-ink/40">&rsaquo;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Skill matrix</h2>
        <p className="text-sm text-ink/60 mb-4">
          Each cell shows mastery (0&ndash;5) for one skill in one chapter. Hover for details.
        </p>
        {!members?.length ? (
          <p className="text-ink/60">No students yet.</p>
        ) : (
          <div className="overflow-x-auto card p-3">
            <table className="text-sm border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left p-2">Student</th>
                  {chapters?.map((ch: any) => (
                    <th
                      key={ch.id}
                      colSpan={skills?.length ?? 1}
                      className="text-xs p-1 text-ink/60 border-b border-ink/10"
                    >
                      Ch {ch.number}: {ch.title}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th></th>
                  {chapters?.flatMap((ch: any) =>
                    skills?.map((sk: any) => (
                      <th
                        key={ch.id + sk.id}
                        className="text-[10px] p-0 align-bottom whitespace-nowrap"
                      >
                        <div className="rotate-[-60deg] origin-bottom-left translate-y-2 inline-block max-w-[2.5rem] text-ink/60">
                          {sk.display_name}
                        </div>
                      </th>
                    )) ?? []
                  )}
                </tr>
              </thead>
              <tbody>
                {(members as any[]).map((m) => {
                  const sid = m.student_id;
                  const p: any = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                  const name = p?.display_name ?? p?.email ?? "Unknown";
                  return (
                    <tr key={sid}>
                      <td className="p-2 whitespace-nowrap">
                        <Link
                          className="hover:underline"
                          href={`/teacher/classes/${klass.id}/students/${sid}`}
                        >
                          {name}
                        </Link>
                      </td>
                      {chapters?.flatMap((ch: any) =>
                        skills?.map((sk: any) => {
                          const lvl = pmap[sid]?.[ch.id]?.[sk.id] ?? 0;
                          return (
                            <td key={ch.id + sk.id} className="p-0">
                              <div
                                title={`${sk.display_name} - Ch ${ch.number} - mastery ${lvl}/5`}
                                className={`mastery-cell ${MASTERY_COLORS[Math.min(5, Math.max(0, lvl))]}`}
                              />
                            </td>
                          );
                        }) ?? []
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-2 mt-3 text-xs text-ink/60">
              <span>Mastery:</span>
              {MASTERY_COLORS.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={`h-3 w-3 rounded ${c} border border-ink/10`} /> {i}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Recent attempts</h2>
        {!myAttempts.length ? (
          <p className="text-ink/60">No attempts yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {(myAttempts as any[]).map((a) => {
              const member: any = (members as any[])?.find((m: any) => m.student_id === a.student_id);
              const p: any = member ? (Array.isArray(member.profiles) ? member.profiles[0] : member.profiles) : null;
              const name = p?.display_name ?? p?.email ?? "Unknown";
              const exer: any = Array.isArray(a.exercises) ? a.exercises[0] : a.exercises;
              return (
                <li key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <Link
                      className="font-medium hover:underline"
                      href={`/teacher/classes/${klass.id}/students/${a.student_id}`}
                    >
                      {name}
                    </Link>
                    <div className="text-xs text-ink/60">{exer?.title}</div>
                  </div>
                  <div className="text-sm">
                    <span className="font-mono">{a.correct_questions}/{a.total_questions}</span>
                    <span className="ml-3 chip-olive">{a.score_pct ?? 0}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
