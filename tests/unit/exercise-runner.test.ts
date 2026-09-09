import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseRunner from "@/components/ExerciseRunner";
import type { Exercise, ExerciseQuestionPublic } from "@/lib/types";

const api = vi.hoisted(() => ({ check: vi.fn(), submit: vi.fn() }));
vi.mock("@/app/learn/actions", () => ({ checkAnswer: api.check, submitExercise: api.submit }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/image", () => ({ default: "img" }));

const questions = Array.from({ length: 20 }, (_, i) => ({
  id: `q-${i}`, prompt: `Question ${i}`, options: ["correct", "wrong"], metadata: {},
})) as ExerciseQuestionPublic[];
const exercise = { id: "exercise", title: "QA exercise", game_type: "multiple_choice" } as Exercise;
let renderer: ReactTestRenderer;
function button(label: string) {
  return renderer.root.findAllByType("button").find(b => b.children.join("") === label)!;
}
async function click(label: string) {
  const target = button(label);
  expect(target, `Missing button: ${label}`).toBeDefined();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => { await target.props.onClick(); });
}
async function complete() {
  for (let i = 0; i < 20; i++) {
    await click("correct");
    await click("Check");
    await click(i === 19 ? "Finish" : "Next");
  }
}
beforeEach(async () => {
  vi.resetAllMocks();
  api.check.mockResolvedValue({ is_correct: true, correct_answer: "correct" });
  api.submit.mockResolvedValue({ score_pct: 100, correct: 20, total: 20, badge_earned: false,
    results: questions.map(q => ({ question_id: q.id, is_correct: true, correct_answer: "correct" })) });
  await act(async () => { renderer = create(React.createElement(ExerciseRunner, { exercise, questions, backHref: "/learn" })); });
});
afterEach(() => { act(() => renderer.unmount()); });
describe("20-question exercise flow", () => {
  it("finishes with all 20 unique answers and allows a second complete attempt", async () => {
    await complete();
    expect(api.submit).toHaveBeenCalledWith("exercise", questions.map(q => ({ question_id: q.id, student_answer: "correct" })));
    expect(JSON.stringify(renderer.toJSON())).toContain("100");
    await click("Try again");
    await complete();
    expect(api.submit).toHaveBeenCalledTimes(2);
  });
  it.each(["returned", "thrown"])("preserves the answer after a %s checking error", async mode => {
    if (mode === "returned") api.check.mockResolvedValueOnce({ error: "Please retry" });
    else api.check.mockRejectedValueOnce(new Error("offline"));
    await click("correct");
    await click("Check");
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(button("Next")).toBeUndefined();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Expected:");
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "q-0", "correct");
    expect(button("Next")).toBeDefined();
  });
  it("retries saving the same 20 answers without losing or duplicating the last answer", async () => {
    api.submit.mockRejectedValueOnce(new Error("offline"));
    await complete();
    expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
    await click("Retry saving results");
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(api.submit.mock.calls[1]).toEqual(api.submit.mock.calls[0]);
    expect(api.submit.mock.calls[1][1]).toHaveLength(20);
    expect(button("Try again")).toBeDefined();
  });
  it("shows saving progress while the server is still responding", async () => {
    let resolve!: (value: unknown) => void;
    api.submit.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    for (let i = 0; i < 20; i++) {
      await click("correct"); await click("Check");
      if (i < 19) await click("Next");
    }
    act(() => { void button("Finish").props.onClick(); });
    expect(renderer.root.findByProps({ role: "status" }).children.join("")).toContain("Saving your results");
    await act(async () => { resolve({ score_pct: 100, correct: 20, total: 20, results: [], badge_earned: false }); });
    expect(button("Try again")).toBeDefined();
  });
});
