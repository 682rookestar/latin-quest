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

  it("preserves tense and number and rejects repeated filler", () => {
    expect(translationMatches("The girls walked quickly home", "The girl walks quickly home")).toBe(false);
    expect(translationMatches("the the the the", "The girl walks quickly home")).toBe(false);
  });

  it("rejects reversed actors, missing negation and missing verbs", () => {
    expect(translationMatches("Remus killed Romulus.", "Romulus killed Remus.")).toBe(false);
    expect(translationMatches("Hannibal did defeat the Romans.", "Hannibal did not defeat the Romans.")).toBe(false);
    expect(translationMatches("Jupiter king", "Jupiter was king.")).toBe(false);
    expect(translationMatches("Jupiter was not king", "Jupiter was king.")).toBe(false);
  });

  it("accepts curated synonyms, articles and negative contractions", () => {
    expect(translationMatches("The girl answered.", "The girl replied.")).toBe(true);
    expect(translationMatches("A girl responded!", "The girl replied.")).toBe(true);
    expect(translationMatches("Hannibal didn’t defeat the Romans", "Hannibal did not defeat the Romans.")).toBe(true);
  });

  it("supports private per-question alternatives, ignoring malformed alternatives", () => {
    expect(scoreAnswer("The girl responded", "The girl gave a reply", "translation", { accepted_answers: [null, "The girl responded"] })).toBe(true);
    expect(scoreAnswer("The girl responded", "The boy gave a reply", "translation", { accepted_answers: "The girl responded" })).toBe(false);
  });

  it.each(["null", "[]", "42", "true", '"noun"', "invalid json"])("rejects malformed sorting payload %s without throwing", payload => {
    expect(scoreAnswer(payload, "", "word_type_sort", { words: [{ word: "rex", type: "noun" }] })).toBe(false);
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
