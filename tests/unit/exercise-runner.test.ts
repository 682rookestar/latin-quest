import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseRunner from "@/components/ExerciseRunner";
import type { Exercise, ExerciseQuestionPublic } from "@/lib/types";
import { DRAFT_KEY } from "@/lib/exercise-draft";

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
afterEach(() => { act(() => renderer.unmount()); vi.unstubAllGlobals(); });
describe("20-question exercise flow", () => {
  it("restores an unfinished attempt after remount and clears its draft after saving", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const mount = async (qs = questions, attemptTicket = "original-ticket") => {
      act(() => renderer.unmount());
      await act(async () => { renderer = create(React.createElement(ExerciseRunner, { exercise, questions: qs, backHref: "/learn", studentId: "pupil-a", attemptTicket })); });
    };
    await mount();
    for (let i = 0; i < 3; i++) { await click("correct"); await click("Check"); await click("Next"); }
    await click("correct");
    expect(JSON.parse(store.get(DRAFT_KEY)!).index).toBe(3);
    await mount([...questions].reverse(), "replacement-ticket");
    expect(JSON.stringify(renderer.toJSON())).toContain("unfinished exercise has been restored");
    expect(button("Next")).toBeUndefined();
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "q-3", "correct");
    await click("Next");
    for (let i = 4; i < 20; i++) { await click("correct"); await click("Check"); await click(i === 19 ? "Finish" : "Next"); }
    expect(api.submit).toHaveBeenCalledWith("exercise", questions.map(q => ({ question_id: q.id, student_answer: "correct" })), "original-ticket");
    expect(store.has(DRAFT_KEY)).toBe(false);
  });
  it.each(["vocab_match", "fill_gap", "tense_id", "case_id", "adjective_agree", "adverb_use", "preposition_picture", "multiple_choice"] as const)("submits the selected answer for %s", async game_type => {
    await act(async () => { renderer.update(React.createElement(ExerciseRunner, { exercise: { ...exercise, game_type }, questions, backHref: "/learn" })); });
    await click("correct");
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "q-0", "correct");
    expect(button("correct").props.disabled).toBe(true);
  });
  it.each(["translation", "fill_gap"] as const)("preserves typed Latin text during a %s connection failure", async game_type => {
    act(() => renderer.unmount());
    await act(async () => { renderer = create(React.createElement(ExerciseRunner, { exercise: { ...exercise, game_type }, questions: questions.map(q => ({ ...q, options: [] })), backHref: "/learn" })); });
    const tag = game_type === "translation" ? "textarea" : "input";
    act(() => renderer.root.findByType(tag).props.onChange({ target: { value: "  puella āmat  " } }));
    api.check.mockRejectedValueOnce(new Error("offline"));
    await click("Check");
    expect(renderer.root.findByType(tag).props.value).toBe("  puella āmat  ");
    expect(button("Next")).toBeUndefined();
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "q-0", "puella āmat");
  });
  it("serialises word sorting and resets the selections on the next question", async () => {
    act(() => renderer.unmount());
    const sortingQuestions = questions.map(q => ({ ...q, metadata: { words: [{ word: "puella" }, { word: "amat" }], types: ["noun", "verb"] } }));
    await act(async () => { renderer = create(React.createElement(ExerciseRunner, { exercise: { ...exercise, game_type: "word_type_sort" }, questions: sortingQuestions, backHref: "/learn" })); });
    act(() => renderer.root.findAllByType("select")[0].props.onChange({ target: { value: "noun" } }));
    act(() => renderer.root.findAllByType("select")[1].props.onChange({ target: { value: "verb" } }));
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "q-0", JSON.stringify({ puella: "noun", amat: "verb" }));
    await click("Next");
    expect(renderer.root.findAllByType("select").map(s => s.props.value)).toEqual(["", ""]);
    expect(button("Check").props.disabled).toBe(true);
  });
  it("keeps the issued questions stable when server actions refresh shuffled props", async () => {
    for (let i = 0; i < 20; i++) {
      await click("correct");
      await click("Check");
      const shuffled = [...questions.slice(i + 1), ...questions.slice(0, i + 1)];
      await act(async () => { renderer.update(React.createElement(ExerciseRunner, { exercise, questions: shuffled, backHref: "/learn" })); });
      await click(i === 19 ? "Finish" : "Next");
    }
    expect(api.check.mock.calls.map(call => call[1])).toEqual(questions.map(q => q.id));
    expect(api.submit).toHaveBeenCalledWith("exercise", questions.map(q => ({ question_id: q.id, student_answer: "correct" })));
  });
  it("keeps a boss sample stable during checking and adopts fresh questions only on Try again", async () => {
    const boss = { ...exercise, is_boss: true };
    await act(async () => { renderer.update(React.createElement(ExerciseRunner, { exercise: boss, questions, backHref: "/learn" })); });
    const replacement = questions.map(q => ({ ...q, id: `new-${q.id}`, prompt: `New ${q.prompt}` }));
    api.check.mockImplementationOnce(async () => {
      renderer.update(React.createElement(ExerciseRunner, { exercise: boss, questions: replacement, backHref: "/learn" }));
      return { is_correct: true, correct_answer: "correct" };
    });
    await complete();
    expect(api.submit).toHaveBeenCalledWith("exercise", questions.map(q => ({ question_id: q.id, student_answer: "correct" })));
    await click("Try again");
    await click("correct");
    await click("Check");
    expect(api.check).toHaveBeenLastCalledWith("exercise", "new-q-0", "correct");
  });
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
