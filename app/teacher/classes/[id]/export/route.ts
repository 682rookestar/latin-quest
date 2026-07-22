import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

function safeFile(s: string) {
  return s.replace(/[^a-z0-9\-_]+/gi, "_").slice(0, 60) || "class";
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toISOString().replace("T", " ").slice(0, 16);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Exports contain identifiable pupil data. Teachers may export only their
  // own classes; administrators retain platform-wide oversight.
  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!teacherProfile || !["teacher", "admin"].includes(teacherProfile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, teacher_id, join_code")
    .eq("id", id)
    .single();
  if (!klass)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (teacherProfile.role === "teacher" && klass.teacher_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Optional ?student=<uuid> filters to one student
  const studentFilter = req.nextUrl.searchParams.get("student");

  const [{ data: members }, { data: chapters }, { data: skills }] = await Promise.all([
    supabase
      .from("class_members")
      .select("student_id, profiles(id, display_name, email)")
      .eq("class_id", id),
    supabase.from("chapters").select("id, number, title").order("number"),
    supabase.from("skills").select("id, code, display_name").order("display_name"),
  ]);

  const allStudentIds = (members ?? []).map((m: any) => m.student_id);
  const studentIds = studentFilter
    ? allStudentIds.filter((id) => id === studentFilter)
    : allStudentIds;

  if (!studentIds.length) {
    return NextResponse.json({ error: "No students" }, { status: 404 });
  }

  const [{ data: progress }, { data: attempts }] = await Promise.all([
    supabase
      .from("skill_progress")
      .select("student_id, chapter_id, skill_id, attempts, correct, mastery, last_attempted_at")
      .in("student_id", studentIds),
    supabase
      .from("attempts")
      .select("id, student_id, exercise_id, started_at, completed_at, score_pct, total_questions, correct_questions, exercises(title, game_type, chapter_id)")
      .in("student_id", studentIds)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
  ]);

  // Resolve chapter title per attempt
  const chapterMap: Record<string, { number: number; title: string }> = {};
  for (const c of (chapters ?? []) as any[]) chapterMap[c.id] = { number: c.number, title: c.title };

  const skillMap: Record<string, string> = {};
  for (const s of (skills ?? []) as any[]) skillMap[s.id] = s.display_name;

  const studentMap: Record<string, { name: string; email: string }> = {};
  for (const m of (members ?? []) as any[]) {
    const p: any = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    studentMap[m.student_id] = {
      name: p?.display_name ?? "",
      email: p?.email ?? "",
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Latin Quest";
  wb.created = new Date();

  // ============ Sheet 1: Class summary ============
  const sum = wb.addWorksheet("Class summary");
  const sumHeader = ["Student", "Email", "Attempts", "Avg score %"];
  for (const ch of (chapters ?? []) as any[]) {
    sumHeader.push(`Ch ${ch.number} mastery /5`);
  }
  sum.addRow(sumHeader);
  sum.getRow(1).font = { bold: true };

  // Aggregate per student
  const perStudentAtt: Record<string, { n: number; sumPct: number }> = {};
  for (const a of (attempts ?? []) as any[]) {
    const s = a.student_id;
    perStudentAtt[s] ??= { n: 0, sumPct: 0 };
    perStudentAtt[s].n += 1;
    perStudentAtt[s].sumPct += a.score_pct ?? 0;
  }

  const perStudentChapMastery: Record<string, Record<string, { sum: number; n: number }>> = {};
  for (const p of (progress ?? []) as any[]) {
    perStudentChapMastery[p.student_id] ??= {};
    perStudentChapMastery[p.student_id][p.chapter_id] ??= { sum: 0, n: 0 };
    perStudentChapMastery[p.student_id][p.chapter_id].sum += p.mastery;
    perStudentChapMastery[p.student_id][p.chapter_id].n += 1;
  }

  for (const sid of studentIds) {
    const s = studentMap[sid] ?? { name: "", email: "" };
    const att = perStudentAtt[sid] ?? { n: 0, sumPct: 0 };
    const avg = att.n ? Math.round(att.sumPct / att.n) : 0;
    const row: (string | number)[] = [s.name, s.email, att.n, avg];
    for (const ch of (chapters ?? []) as any[]) {
      const m = perStudentChapMastery[sid]?.[ch.id];
      row.push(m && m.n ? Math.round((m.sum / m.n) * 10) / 10 : 0);
    }
    sum.addRow(row);
  }
  sum.columns.forEach((col) => {
    let max = 8;
    col.eachCell?.((cell) => {
      const v = cell.value ?? "";
      const len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(40, max + 2);
  });

  // ============ Sheet 2: Attempts log ============
  const log = wb.addWorksheet("Attempts");
  log.addRow([
    "Student",
    "Email",
    "Chapter",
    "Exercise",
    "Game type",
    "Started",
    "Completed",
    "Total",
    "Correct",
    "Score %",
  ]);
  log.getRow(1).font = { bold: true };

  for (const a of (attempts ?? []) as any[]) {
    const ex: any = Array.isArray(a.exercises) ? a.exercises[0] : a.exercises;
    const ch = ex ? chapterMap[ex.chapter_id] : null;
    const s = studentMap[a.student_id] ?? { name: "", email: "" };
    log.addRow([
      s.name,
      s.email,
      ch ? `Ch ${ch.number}: ${ch.title}` : "",
      ex?.title ?? "",
      ex?.game_type ?? "",
      fmtDate(a.started_at),
      fmtDate(a.completed_at),
      a.total_questions ?? 0,
      a.correct_questions ?? 0,
      a.score_pct ?? 0,
    ]);
  }
  log.columns.forEach((col, idx) => {
    let max = idx === 0 || idx === 3 ? 20 : 12;
    col.eachCell?.((cell) => {
      const v = cell.value ?? "";
      const len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(50, max + 2);
  });

  // ============ Sheet 3: Skill progress ============
  const sp = wb.addWorksheet("Skill progress");
  sp.addRow([
    "Student",
    "Email",
    "Chapter",
    "Skill",
    "Attempts",
    "Correct",
    "Mastery /5",
    "Last attempted",
  ]);
  sp.getRow(1).font = { bold: true };

  for (const p of (progress ?? []) as any[]) {
    const ch = chapterMap[p.chapter_id];
    const s = studentMap[p.student_id] ?? { name: "", email: "" };
    sp.addRow([
      s.name,
      s.email,
      ch ? `Ch ${ch.number}: ${ch.title}` : "",
      skillMap[p.skill_id] ?? "",
      p.attempts,
      p.correct,
      p.mastery,
      fmtDate(p.last_attempted_at),
    ]);
  }
  sp.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.((cell) => {
      const v = cell.value ?? "";
      const len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(40, max + 2);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename =
    studentFilter && studentMap[studentFilter]
      ? `${safeFile(klass.name)}_${safeFile(studentMap[studentFilter].name || "student")}.xlsx`
      : `${safeFile(klass.name)}.xlsx`;

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
