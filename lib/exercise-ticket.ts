// Node/server module. Never import this from a client component.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type Ticket = { v: 1; id: string; pupil: string; exercise: string; questions: string[]; expires: number };
const lifetime = 24 * 60 * 60 * 1000;
function signature(payload: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Attempt signing is unavailable");
  return createHmac("sha256", key).update(`latin-quest-attempt-v1:${payload}`).digest();
}
export function issueExerciseTicket(pupil: string, exercise: string, questions: string[], now = Date.now()): string {
  if (!questions.length || questions.length > 100 || new Set(questions).size !== questions.length) throw new Error("Invalid question set");
  const ticket: Ticket = { v: 1, id: randomUUID(), pupil, exercise, questions, expires: now + lifetime };
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}
export function verifyExerciseTicket(token: unknown, pupil: string, exercise: string, questions: string[], now = Date.now()): Ticket {
  const invalid = () => { throw new Error("Invalid or expired exercise attempt. Reload to start a new attempt."); };
  if (typeof token !== "string" || token.length > 20000) return invalid();
  const parts = token.split(".");
  if (parts.length !== 2) return invalid();
  const expected = signature(parts[0]);
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return invalid();
  let t: Ticket;
  try { t = JSON.parse(Buffer.from(parts[0], "base64url").toString()); } catch { return invalid(); }
  if (t.v !== 1 || t.pupil !== pupil || t.exercise !== exercise || !Number.isFinite(t.expires) || t.expires <= now ||
      !Array.isArray(t.questions) || t.questions.length !== questions.length ||
      t.questions.some((q, i) => q !== questions[i])) return invalid();
  return t;
}
