import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { issueExerciseTicket, verifyExerciseTicket } from "@/lib/exercise-ticket";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key-not-a-real-credential"));
afterEach(() => vi.unstubAllEnvs());
it("binds a ticket to pupil, exercise, full ordered question set and expiry", () => {
  const token = issueExerciseTicket("pupil", "exercise", ["q1", "q2"], 1000);
  expect(verifyExerciseTicket(token, "pupil", "exercise", ["q1", "q2"], 1001).id).toBeTruthy();
  for (const [pupil, exercise, ids] of [["other", "exercise", ["q1", "q2"]], ["pupil", "other", ["q1", "q2"]], ["pupil", "exercise", ["q1"]], ["pupil", "exercise", ["q2", "q1"]]] as const) {
    expect(() => verifyExerciseTicket(token, pupil, exercise, [...ids], 1001)).toThrow();
  }
  expect(() => verifyExerciseTicket(token, "pupil", "exercise", ["q1", "q2"], 1000 + 86400000)).toThrow();
});
it("rejects altered signatures and question lists", () => {
  const token = issueExerciseTicket("pupil", "exercise", ["q1"]);
  const [payload, sig] = token.split(".");
  const changed = JSON.parse(Buffer.from(payload, "base64url").toString());
  changed.questions = ["q2"];
  expect(() => verifyExerciseTicket(`${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${sig}`, "pupil", "exercise", ["q2"])).toThrow();
  expect(() => verifyExerciseTicket(`${payload}.invalid`, "pupil", "exercise", ["q1"])).toThrow();
  expect(() => verifyExerciseTicket(undefined, "pupil", "exercise", ["q1"])).toThrow();
});
