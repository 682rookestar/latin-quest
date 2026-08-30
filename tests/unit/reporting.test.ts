import { describe, expect, it } from "vitest";
import { buildReportPrompt, checkHallifordStyle } from "@/lib/reporting";

const validComment =
  "William has approached Latin lessons with steady engagement and has used Latin Quest regularly to consolidate vocabulary. His accurate work in Chapter 2 demonstrates secure recall and increasingly confident application of grammar. William should now focus on checking noun endings carefully and completing short, frequent practice sessions so that this accuracy is sustained in unfamiliar translation tasks.";

describe("Halliford report validation", () => {
  it("accepts a complete comment within the character limit", () => {
    const checks = checkHallifordStyle(validComment, "William");
    expect(checks.some((check) => check.level === "error")).toBe(false);
    expect(checks.some((check) => check.message.includes("preferred name"))).toBe(true);
  });

  it("blocks comments outside the required character range", () => {
    const checks = checkHallifordStyle("William has worked well in Latin Quest.", "William");
    expect(checks.some((check) => check.level === "error")).toBe(true);
  });

  it("flags contractions and well-wishing endings", () => {
    const comment = `${validComment} He shouldn't rush. Good luck next year!`;
    const checks = checkHallifordStyle(comment, "William");
    expect(checks.some((check) => check.message.includes("contractions"))).toBe(true);
    expect(checks.some((check) => check.message.includes("well-wishing"))).toBe(true);
  });
});

describe("report drafting prompt", () => {
  it("instructs the model not to invent missing evidence", () => {
    const prompt = buildReportPrompt({
      preferredName: "William",
      className: "Year 7 Latin",
      evidence: {
        period: { name: "Summer", startsOn: "2025-09-01", endsOn: "2026-06-19" },
        attemptCount: 2,
        averageScore: 80,
        questionsAnswered: 20,
        questionsCorrect: 16,
        practiceDays: 2,
        firstActivity: "2026-01-01T10:00:00Z",
        lastActivity: "2026-01-02T10:00:00Z",
        strongestChapter: "Chapter 1: Foundations",
        developmentChapter: null,
        chapterBreakdown: [],
        skillBreakdown: [],
        badges: [],
      },
      inputs: {
        bflEngagement: null,
        bflClasswork: null,
        bflIndependentStudy: null,
        progressGrade: null,
        lessonObservations: "",
        strengths: "",
        improvementTargets: "",
        schoolValues: "",
        beneNotes: "",
      },
    });
    expect(prompt).toContain("Do not invent");
    expect(prompt).toContain("Do not mention email addresses");
  });
});
