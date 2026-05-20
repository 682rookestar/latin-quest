import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MASTERY_COLORS = [
  "bg-ink/5",       // 0
  "bg-wine/15",
  "bg-wine/30",
  "bg-gold/40",
  "bg-olive/50",
  "bg-olive/70",   // 5
];

export default async function ClassDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, join_code, teacher_id")
    .eq("id", params.id)
    .single();
  if (!klass || klass.teacher_id !== user.id) redirect("/teacher");

  const [{ data: members }, { data: chapters }, { data: skills }, { data: progress }, { data: attempts }] = await Promise.all([
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
  ]);

  const studentIds = new Set((members ?? []).map((m: any) => m.student_id));
  const myProgress = (progress ?? []).filter((p: any) => studentIds.has(p.student_id));
  const myAttempts = (attempts ?? []).filter((a: any) => studentIds.has(a.student_id));

  // Build per-student aggregate {studentId: {chapterId: {skillId: mastery}}}
  const pmap: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of myProgress as any[]) {
    pmap[row.student_id] ??= {};
    pmap[row.student_id][row.chapter_id] ??= {};
    pmap[row.student_id][row.chapter_id][row.skill_id] = row.mastery;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{klass.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="chip-gold">Join code: <span className="font-mono ml-1">{klass.join_code}</span></span>
          <span className="text-sm text-ink/60">{members?.length ?? 0} student{members?.length === 1 ? "" : "s"}</span>
        </div>
        <p className="text-sm text-ink/60 mt-2">
          Share the join code with your students — they'll enter it at <code>/learn/join</code>.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">Skill matrix</h2>
        <p className="text-sm text-ink/60 mb-4">
          Each cell shows mastery (0–5) for one skill in one chapter. Hover for details.
        </p>
        {!members?.length ? (
          <p className="text-ink/60">No students yet. Once they join with the code, their progress will appear here.</p>
        ) : (
          <div className="overflow-x-auto card p-3">
            <table className="text-sm border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left p-2">Student</th>
                  {chapters?.map((ch:any)=>(
                    <th key={ch.id} colSpan={skills?.length ?? 1} className="text-xs p-1 text-ink/60 border-b border-ink/10">
                      Ch {ch.number}: {ch.title}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th></th>
                  {chapters?.flatMap((ch:any)=>skills?.map((sk:any)=>(
                    <th key={ch.id+sk.id} className="text-[10px] p-0 align-bottom whitespace-nowrap">
                      <div className="rotate-[-60deg] origin-bottom-left translate-y-2 inline-block max-w-[2.5rem] text-ink/60">
                        {sk.display_name}
                      </div>
                    </th>
                  )) ?? [])}
                </tr>
              </thead>
              <tbody>
                {members.map((m:any)=>{
                  const sid = m.student_id;
                  return (
                    <tr key={sid}>
                      <td className="p-2 whitespace-nowrap">{m.profiles?.display_name ?? m.profiles?.email}</td>
                      {chapters?.flatMap((ch:any)=>skills?.map((sk:any)=>{
                        const lvl = pmap[sid]?.[ch.id]?.[sk.id] ?? 0;
                        return (
                          <td key={ch.id+sk.id} className="p-0">
                            <div
                              title={`${sk.display_name} — Ch ${ch.number} — mastery ${lvl}/5`}
                              className={`mastery-cell ${MASTERY_COLORS[Math.min(5, Math.max(0, lvl))]}`}
                            />
                          </td>
                        );
                      }) ?? [])}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center gap-2 mt-3 text-xs text-ink/60">
              <span>Mastery:</span>
              {MASTERY_COLORS.map((c,i)=>(
                <span key={i} className="flex items-center gap-1">
                  <span className={`h-3 w-3 rounded ${c} border border-ink/10`} /> {i}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Recent attempts</h2>
        {!myAttempts.length ? (
          <p className="text-ink/60">No attempts yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {myAttempts.map((a:any)=>{
              const member: any = members?.find((m:any)=>m.student_id===a.student_id);
              const p: any = member?.profiles;
              const name: string = (Array.isArray(p) ? p[0]?.display_name ?? p[0]?.email : p?.display_name ?? p?.email) ?? "Unknown";
              return (
                <li key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-ink/60">{a.exercises?.title}</div>
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
