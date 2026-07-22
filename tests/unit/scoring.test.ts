import { describe, expect, it } from "vitest";
import {
  answersMatch,
  normaliseAnswer,
  scoreAnswer,
  translationMatches,
} from "@/lib/scoring";

describe("answer scoring", () => {
  it("normalises case, macrons, punctuation and whitespace", () => {
    expect(normaliseAnswer("  Puella,  AMĀT! ")).toBe("puella amat");
    expect(answersMatch("servus", "SERVUS!")).toBe(true);
  });

  it("does not accept a blank translation", () => {
    expect(translationMatches("", "The girl walks home")).toBe(false);
  });

  it("accepts close keyword variants but rejects repeated filler", () => {
    expect(translationMatches("The girls walked quickly home", "The girl walks quickly home")).toBe(true);
    expect(translationMatches("the the the the", "The girl walks quickly home")).toBe(false);
  });

  it("requires every word-sort item and rejects missing metadata", () => {
    const metadata = {
      words: [
        { word: "puella", type: "noun" },
        { word: "amat", type: "verb" },
      ],
    };
    expect(scoreAnswer('{"puella":"noun","amat":"verb"}', "", "word_type_sort", metadata)).toBe(true);
    expect(scoreAnswer('{"puella":"noun"}', "", "word_type_sort", metadata)).toBe(false);
    expect(scoreAnswer("{}", "", "word_type_sort", null)).toBe(false);
  });

  it("rejects oversized submissions", () => {
    expect(scoreAnswer("a".repeat(5001), "a", "multiple_choice", null)).toBe(false);
  });
});
