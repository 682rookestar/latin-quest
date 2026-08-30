"use server";

import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAal2 } from "@/lib/auth-security";
import { createClient } from "@/lib/supabase/server";
import {
  buildReportPrompt,
  checkHallifordStyle,
  containsExcludedReportMetrics,
  type ReportInputs,
  type ReportingEvidence,
} from "@/lib/reporting";

const REPORT_AI_MODEL = process.env.REPORT_AI_MODEL?.trim() || "inclusionai/ling-3.0-flash-fin-free";

export type ReportActionResult = { ok: boolean; message: string };

type AccessContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  className: string;
  period: { id: string; name: string; starts_on: string; ends_on: string; status: string };
  studentName: string;
};

function textValue(formData: FormData, name: string, max = 4000) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalGrade(formData: FormData, name: string, max: number) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
}

function reportPath(classId: string, periodId: string, studentId: string) {
  return `/teacher/classes/${classId}/reports/${periodId}/${studentId}`;
}

async function requireAccess(
  classId: string,
  periodId: string,
  studentId: string
): Promise<AccessContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await hasAal2(supabase))) return null;

  const [{ data: profile }, { data: klass }, { data: period }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("role, disabled_at").eq("id", user.id).single(),
    supabase.from("classes").select("id, name, teacher_id, archived_at").eq("id", classId).single(),
    supabase.from("reporting_periods").select("id, class_id, name, starts_on, ends_on, status").eq("id", periodId).single(),
    supabase.from("class_members").select("student_id, profiles(display_name, email)").eq("class_id", classId).eq("student_id", studentId).maybeSingle(),
  ]);

  const isAdmin = profile?.role === "admin";
  const isOwningTeacher = profile?.role === "teacher" && klass?.teacher_id === user.id;
  if (!profile || profile.disabled_at || (!isAdmin && !isOwningTeacher)) return null;
  if (!klass || klass.archived_at) return null;
  if (!period || period.class_id !== classId || period.status !== "open") return null;
  if (!membership) return null;
  const studentProfile: any = Array.isArray((membership as any).profiles)
    ? (membership as any).profiles[0]
    : (membership as any).profiles;

  return {
    supabase,
    userId: user.id,
    className: klass.name,
    period,
    studentName: studentProfile?.display_name || studentProfile?.email?.split("@")[0] || "the pupil",
  };
}

function readInputs(formData: FormData): ReportInputs {
  return {
    bflEngagement: optionalGrade(formData, "bfl_engagement", 5),
    bflClasswork: optionalGrade(formData, "bfl_classwork", 5),
    bflIndependentStudy: optionalGrade(formData, "bfl_independent_study", 5),
    progressGrade: optionalGrade(formData, "progress_grade", 9),
    lessonObservations: textValue(formData, "lesson_observations"),
    strengths: textValue(formData, "strengths"),
    improvementTargets: textValue(formData, "improvement_targets"),
    schoolValues: textValue(formData, "school_values"),
    beneNotes: textValue(formData, "bene_notes"),
  };
}

function reportRecord(
  periodId: string,
  studentId: string,
  userId: string,
  inputs: ReportInputs,
  currentComment: string
) {
  return {
    period_id: periodId,
    student_id: studentId,
    authored_by: userId,
    bfl_engagement: inputs.bflEngagement,
    bfl_classwork: inputs.bflClasswork,
    bfl_independent_study: inputs.bflIndependentStudy,
    progress_grade: inputs.progressGrade,
    lesson_observations: inputs.lessonObservations,
    strengths: inputs.strengths,
    improvement_targets: inputs.improvementTargets,
    school_values: inputs.schoolValues,
    bene_notes: inputs.beneNotes,
    current_comment: currentComment,
    updated_at: new Date().toISOString(),
  };
}

async function collectEvidence(
  context: AccessContext,
  studentId: string
): Promise<ReportingEvidence> {
  const start = `${context.period.starts_on}T00:00:00.000Z`;
  const end = `${context.period.ends_on}T23:59:59.999Z`;
  const [{ data: attempts }, { data: badges }] = await Promise.all([
    context.supabase
      .from("attempts")
      .select("score_pct, total_questions, correct_questions, completed_at, exercises(title, chapters(number, title), skills(display_name))")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .gte("completed_at", start)
      .lte("completed_at", end)
      .order("completed_at"),
    context.supabase
      .from("chapter_badges")
      .select("awarded_at, chapters(number, title)")
      .eq("student_id", studentId)
      .gte("awarded_at", start)
      .lte("awarded_at", end),
  ]);

  const chapterMap = new Map<string, { attempts: number; questions: number; correct: number }>();
  let scoreTotal = 0;
  let scoredAttempts = 0;
  let questions = 0;
  let correct = 0;
  const days = new Set<string>();
  const skillMap = new Map<string, { attempts: number; questions: number; correct: number }>();

  for (const row of (attempts ?? []) as any[]) {
    if (row.score_pct != null) {
      scoreTotal += row.score_pct;
      scoredAttempts += 1;
    }
    questions += row.total_questions ?? 0;
    correct += row.correct_questions ?? 0;
    if (row.completed_at) days.add(String(row.completed_at).slice(0, 10));
    const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    const chapter = exercise && (Array.isArray(exercise.chapters) ? exercise.chapters[0] : exercise.chapters);
    const label = chapter ? `Chapter ${chapter.number}: ${chapter.title}` : "Uncategorised practice";
    const agg = chapterMap.get(label) ?? { attempts: 0, questions: 0, correct: 0 };
    agg.attempts += 1;
    agg.questions += row.total_questions ?? 0;
    agg.correct += row.correct_questions ?? 0;
    chapterMap.set(label, agg);
    const skill = exercise && (Array.isArray(exercise.skills) ? exercise.skills[0] : exercise.skills);
    const skillLabel = skill?.display_name ?? "Uncategorised skill";
    const skillAgg = skillMap.get(skillLabel) ?? { attempts: 0, questions: 0, correct: 0 };
    skillAgg.attempts += 1;
    skillAgg.questions += row.total_questions ?? 0;
    skillAgg.correct += row.correct_questions ?? 0;
    skillMap.set(skillLabel, skillAgg);
  }

  const chapterBreakdown = [...chapterMap.entries()].map(([chapter, agg]) => ({
    chapter,
    ...agg,
    accuracy: agg.questions ? Math.round((agg.correct / agg.questions) * 100) : 0,
  }));
  const ranked = [...chapterBreakdown].filter((chapter) => chapter.questions > 0).sort((a, b) => b.accuracy - a.accuracy);

  const skillBreakdown = [...skillMap.entries()].map(([skill, agg]) => ({
    skill,
    attempts: agg.attempts,
    correct: agg.correct,
    accuracy: agg.questions ? Math.round((agg.correct / agg.questions) * 100) : 0,
    mastery: agg.questions ? Math.min(5, Math.floor((agg.correct * 5) / agg.questions)) : 0,
  }));

  return {
    period: {
      name: context.period.name,
      startsOn: context.period.starts_on,
      endsOn: context.period.ends_on,
    },
    attemptCount: attempts?.length ?? 0,
    averageScore: scoredAttempts ? Math.round(scoreTotal / scoredAttempts) : null,
    questionsAnswered: questions,
    questionsCorrect: correct,
    practiceDays: days.size,
    firstActivity: attempts?.[0]?.completed_at ?? null,
    lastActivity: attempts?.[attempts.length - 1]?.completed_at ?? null,
    strongestChapter: ranked[0]?.chapter ?? null,
    developmentChapter: ranked.length > 1 ? ranked[ranked.length - 1]?.chapter ?? null : null,
    chapterBreakdown,
    skillBreakdown,
    badges: ((badges ?? []) as any[]).map((row) => {
      const chapter = Array.isArray(row.chapters) ? row.chapters[0] : row.chapters;
      return chapter ? `Chapter ${chapter.number}: ${chapter.title}` : "Chapter badge";
    }),
  };
}

export async function createReportingPeriod(formData: FormData) {
  const classId = textValue(formData, "class_id", 100);
  const name = textValue(formData, "name", 80);
  const startsOn = textValue(formData, "starts_on", 10);
  const endsOn = textValue(formData, "ends_on", 10);
  const dueAt = textValue(formData, "due_at", 40) || null;
  if (!classId || name.length < 2 || !startsOn || !endsOn || endsOn < startsOn) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await hasAal2(supabase))) redirect("/account?mfa=required");

  const [{ data: profile }, { data: klass }] = await Promise.all([
    supabase.from("profiles").select("role, disabled_at").eq("id", user.id).single(),
    supabase.from("classes").select("teacher_id, archived_at").eq("id", classId).single(),
  ]);
  const isAdmin = profile?.role === "admin";
  const isOwningTeacher = profile?.role === "teacher" && klass?.teacher_id === user.id;
  if (!profile || profile.disabled_at || !klass || klass.archived_at || (!isAdmin && !isOwningTeacher)) {
    redirect(profile?.role === "admin" ? "/admin/classes" : "/teacher");
  }

  const { error } = await supabase.from("reporting_periods").insert({
    class_id: classId,
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/teacher/classes/${classId}/reports`);
}

export async function saveStudentReport(
  _previous: ReportActionResult | null,
  formData: FormData
): Promise<ReportActionResult> {
  const classId = textValue(formData, "class_id", 100);
  const periodId = textValue(formData, "period_id", 100);
  const studentId = textValue(formData, "student_id", 100);
  const context = await requireAccess(classId, periodId, studentId);
  if (!context) return { ok: false, message: "You do not have access to this report." };

  const inputs = readInputs(formData);
  const currentComment = textValue(formData, "current_comment", 1200);
  const { error } = await context.supabase.from("student_reports").upsert(
    {
      ...reportRecord(periodId, studentId, context.userId, inputs, currentComment),
      status: "draft",
      approved_at: null,
      approved_by: null,
    },
    { onConflict: "period_id,student_id" }
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath(reportPath(classId, periodId, studentId));
  revalidatePath(`/teacher/classes/${classId}/reports`);
  return { ok: true, message: "Report saved." };
}

export async function generateStudentReport(
  _previous: ReportActionResult | null,
  formData: FormData
): Promise<ReportActionResult> {
  const classId = textValue(formData, "class_id", 100);
  const periodId = textValue(formData, "period_id", 100);
  const studentId = textValue(formData, "student_id", 100);
  const context = await requireAccess(classId, periodId, studentId);
  if (!context) return { ok: false, message: "You do not have access to this report." };

  const inputs = readInputs(formData);
  const evidence = await collectEvidence(context, studentId);
  if (!evidence.attemptCount) {
    return { ok: false, message: "There is no completed Latin Quest activity in this reporting period yet." };
  }

  try {
    const { text } = await generateText({
      model: REPORT_AI_MODEL,
      prompt: buildReportPrompt({
        preferredName: context.studentName,
        className: context.className,
        evidence,
        inputs,
      }),
    });
    const draft = text.trim();
    if (!draft) return { ok: false, message: "The drafting service returned an empty response." };
    if (containsExcludedReportMetrics(draft)) {
      return { ok: false, message: "The generated report included a percentage or badge reference. Please generate it again." };
    }
    if (draft.length > 1200) {
      return { ok: false, message: "The generated draft exceeded Halliford's 1,200-character limit. Please generate it again." };
    }

    const { error } = await context.supabase.from("student_reports").upsert({
      ...reportRecord(periodId, studentId, context.userId, inputs, draft),
      evidence_snapshot: evidence,
      ai_draft: draft,
      ai_model: REPORT_AI_MODEL,
      generated_at: new Date().toISOString(),
      generated_by: context.userId,
      status: "generated",
      approved_at: null,
      approved_by: null,
    }, { onConflict: "period_id,student_id" });
    if (error) return { ok: false, message: error.message };

    const styleErrors = checkHallifordStyle(draft, context.studentName).filter((check) => check.level === "error");
    revalidatePath(reportPath(classId, periodId, studentId));
    revalidatePath(`/teacher/classes/${classId}/reports`);
    return {
      ok: true,
      message: styleErrors.length
        ? "Draft generated. Review the highlighted style issue before approval."
        : "Report generated from the pupil's Latin Quest evidence.",
    };
  } catch (error) {
    console.error("[reporting] AI draft failed", {
      model: REPORT_AI_MODEL,
      classId,
      periodId,
      studentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "The report generator is temporarily unavailable. Please try again shortly." };
  }
}

export async function approveStudentReport(
  _previous: ReportActionResult | null,
  formData: FormData
): Promise<ReportActionResult> {
  const classId = textValue(formData, "class_id", 100);
  const periodId = textValue(formData, "period_id", 100);
  const studentId = textValue(formData, "student_id", 100);
  const context = await requireAccess(classId, periodId, studentId);
  if (!context) return { ok: false, message: "You do not have access to this report." };

  const inputs = readInputs(formData);
  const currentComment = textValue(formData, "current_comment", 1200);
  const blocking = checkHallifordStyle(currentComment, context.studentName).filter((check) => check.level === "error");
  if (blocking.length) return { ok: false, message: blocking[0].message };

  const { error } = await context.supabase.from("student_reports").upsert({
    ...reportRecord(periodId, studentId, context.userId, inputs, currentComment),
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: context.userId,
  }, { onConflict: "period_id,student_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath(reportPath(classId, periodId, studentId));
  revalidatePath(`/teacher/classes/${classId}/reports`);
  return { ok: true, message: "Report approved and locked into the audit history." };
}
