import { describe, expect, it } from "vitest";
import { publicQuestionMetadata, safeRedirectUrl } from "@/lib/security";

describe("authentication redirects", () => {
  const origin = "https://latin-quest.vercel.app";

  it("allows same-origin application paths", () => {
    expect(safeRedirectUrl(origin, "/account?mfa=required").toString()).toBe(
      "https://latin-quest.vercel.app/account?mfa=required"
    );
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "@evil.example",
    "/\\evil.example/phish",
  ])("rejects an unsafe destination: %s", (next) => {
    expect(safeRedirectUrl(origin, next).toString()).toBe(
      "https://latin-quest.vercel.app/dashboard"
    );
  });
});

describe("public exercise metadata", () => {
  it("removes word-sort answers while retaining render data", () => {
    expect(
      publicQuestionMetadata(
        {
          words: [
            { word: "puella", type: "noun" },
            { word: "amat", type: "verb" },
          ],
          types: ["noun", "verb"],
          internal_note: "secret",
        },
        "word_type_sort"
      )
    ).toEqual({
      words: [{ word: "puella" }, { word: "amat" }],
      types: ["noun", "verb"],
    });
  });

  it("keeps unknown metadata private by default", () => {
    expect(publicQuestionMetadata({ answer_hint: "secret" }, "new_game")).toBeNull();
  });
});
