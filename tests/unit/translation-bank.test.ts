import { describe, expect, it } from "vitest";
import { translationAlternatives } from "@/lib/translation-answers";
import { translationMatches } from "@/lib/scoring";

describe("curated translation bank", () => {
  for (const [canonical, alternatives] of Object.entries(translationAlternatives)) {
    it(`accepts canonical and explicit alternatives: ${canonical}`, () => {
      for (const answer of [canonical, ...alternatives]) {
        expect(translationMatches(answer, canonical)).toBe(true);
        expect(translationMatches(`not ${answer}`, canonical)).toBe(false);
        expect(translationMatches(`${answer} not`, canonical)).toBe(false);
      }
    });
  }
});
