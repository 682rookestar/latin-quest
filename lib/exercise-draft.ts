import type { ExerciseQuestionPublic } from "./types";

export const DRAFT_KEY = "latin-quest:exercise-draft:v1";
export const DRAFT_TTL = 24 * 60 * 60 * 1000;
export type ExerciseDraft = {
  version: 1; owner: string; exercise: string; updatedAt: number;
  questions: ExerciseQuestionPublic[]; index: number; answer: unknown;
  collected: { question_id: string; student_answer: string }[];
  ticket?: string;
};

// Drafts are untrusted UI state, never evidence of correctness or authorization.
export function parseExerciseDraft(raw: string | null, owner: string, exercise: string, now = Date.now()): ExerciseDraft | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const d = JSON.parse(raw);
    if (d.ticket !== undefined && (typeof d.ticket !== "string" || d.ticket.length > 20000)) return null;
    if (d.version !== 1 || d.owner !== owner || d.exercise !== exercise ||
        !Number.isFinite(d.updatedAt) || d.updatedAt > now || now - d.updatedAt >= DRAFT_TTL ||
        !Array.isArray(d.questions) || !d.questions.length || d.questions.length > 100 ||
        !Number.isInteger(d.index) || d.index < 0 || d.index >= d.questions.length ||
        !Array.isArray(d.collected) || ![d.index, d.questions.length].includes(d.collected.length)) return null;
    if (d.collected.length === d.questions.length && d.index !== d.questions.length - 1) return null;
    if (d.questions.some((q: any) => !q || typeof q.id !== "string" || typeof q.prompt !== "string" ||
        (q.options != null && (!Array.isArray(q.options) || q.options.some((o: unknown) => typeof o !== "string"))))) return null;
    if (new Set(d.questions.map((q: any) => q.id)).size !== d.questions.length) return null;
    if (d.collected.some((a: any, i: number) => !a || a.question_id !== d.questions[i].id || typeof a.student_answer !== "string")) return null;
    if (d.answer !== null && typeof d.answer !== "string" &&
        !(typeof d.answer === "object" && !Array.isArray(d.answer) && Object.values(d.answer).every(v => typeof v === "string"))) return null;
    return d;
  } catch { return null; }
}
