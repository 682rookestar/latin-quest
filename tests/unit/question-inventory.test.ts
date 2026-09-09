import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreAnswer } from "@/lib/scoring";
import { translationAlternatives } from "@/lib/translation-answers";

// Supply a read-only content export for a full inventory audit. Pupil data is
// not needed and the production question bank is not committed to this repo.
const snapshot = process.env.LATIN_QUEST_QUESTION_SNAPSHOT;
type Question = { id: string; game_type: string; correct_answer: string; options: string[] | null;
  metadata: { words?: { word: string; type: string }[]; types?: string[] } | null };
const questions: Question[] = snapshot ? JSON.parse(readFileSync(snapshot, "utf8")) : [];
describe.skipIf(!snapshot)("complete question inventory", () => {
  it("contains questions", () => expect(questions.length).toBeGreaterThan(0));
  for (const q of questions) {
    it(`${q.game_type}: ${q.id}`, () => {
      const canonical = q.game_type === "word_type_sort"
        ? JSON.stringify(Object.fromEntries((q.metadata?.words ?? []).map(w => [w.word, w.type])))
        : q.correct_answer;
      expect(scoreAnswer(canonical, q.correct_answer, q.game_type, q.metadata)).toBe(true);
      expect(scoreAnswer("", q.correct_answer, q.game_type, q.metadata)).toBe(false);
      if (q.game_type === "word_type_sort") {
        for (const word of q.metadata?.words ?? []) expect(q.metadata?.types).toContain(word.type);
      } else if (q.game_type === "translation") {
        expect(translationAlternatives[q.correct_answer]?.length).toBeGreaterThan(0);
      } else if (!(q.game_type === "fill_gap" && !q.options?.length)) {
        expect(q.options?.filter(option => scoreAnswer(option, q.correct_answer, q.game_type, q.metadata))).toHaveLength(1);
      }
    });
  }
});
