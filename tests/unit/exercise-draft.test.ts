import { describe, expect, it } from "vitest";
import { DRAFT_TTL, parseExerciseDraft } from "@/lib/exercise-draft";

const draft = { version: 1, owner: "pupil-a", exercise: "exercise-a", updatedAt: 1000,
  questions: [{ id: "q1", prompt: "One", options: ["a"] }, { id: "q2", prompt: "Two", options: [] }],
  index: 1, answer: "āmat", collected: [{ question_id: "q1", student_answer: "a" }] };
const read = (d: unknown, owner = "pupil-a", exercise = "exercise-a", now = 1001) =>
  parseExerciseDraft(JSON.stringify(d), owner, exercise, now);
describe("untrusted exercise drafts", () => {
  it("restores question order, typed Latin and completed answers", () => expect(read(draft)).toEqual(draft));
  it("rejects another pupil or exercise", () => {
    expect(read(draft, "pupil-b")).toBeNull();
    expect(read(draft, "pupil-a", "exercise-b")).toBeNull();
  });
  it("expires after 24 hours and rejects future timestamps", () => {
    expect(read(draft, "pupil-a", "exercise-a", 1000 + DRAFT_TTL)).toBeNull();
    expect(read(draft, "pupil-a", "exercise-a", 999)).toBeNull();
  });
  it("rejects corrupt, duplicate, incomplete and out-of-order records", () => {
    expect(parseExerciseDraft("{", "pupil-a", "exercise-a")).toBeNull();
    expect(read({ ...draft, index: 20 })).toBeNull();
    expect(read({ ...draft, questions: [draft.questions[0], draft.questions[0]] })).toBeNull();
    expect(read({ ...draft, collected: [] })).toBeNull();
    expect(read({ ...draft, collected: [{ question_id: "q2", student_answer: "a" }] })).toBeNull();
  });
  it("retains a pending final save without claiming it was successful", () => {
    const pending = { ...draft, collected: [...draft.collected, { question_id: "q2", student_answer: "āmat" }] };
    expect(read(pending)).toEqual(pending);
  });
});
