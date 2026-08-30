import { describe, expect, it } from "vitest";
import { buildReportPrompt, checkHallifordStyle, containsExcludedReportContent } from "@/lib/reporting";

const validComment =
  "William has approached Latin lessons with steady engagement and has consolidated vocabulary effectively. His accurate work in Chapter 2 demonstrates secure recall and increasingly confident application of grammar. William should now focus on checking noun endings carefully and completing targeted revision so that this accuracy is sustained in unfamiliar translation tasks.";

describe("Halliford report validation", () => {
  it("accepts a complete comment within the character limit", () => {
    const checks = checkHallifordStyle(validComment, "William");
    expect(checks.some((check) => check.level === "error")).toBe(false);
    expect(checks.some((check) => check.message.includes("preferred name"))).toBe(true);
  });

  it("blocks comments outside the required character range", () => {
    const checks = checkHallifordStyle("William has worked well in Latin.", "William");
    expect(checks.some((check) => check.level === "error")).toBe(true);
  });

  it("flags contractions and well-wishing endings", () => {
    const comment = `${validComment} He shouldn't rush. Good luck next year!`;
    const checks = checkHallifordStyle(comment, "William");
    expect(checks.some((check) => check.message.includes("contractions"))).toBe(true);
    expect(checks.some((check) => check.message.includes("well-wishing"))).toBe(true);
  });

  it("detects percentages and badge references", () => {
    expect(containsExcludedReportContent("William achieved 82% and earned a badge.")).toBe(true);
    expect(containsExcludedReportContent("William practised through Latin Quest.")).toBe(true);
    expect(containsExcludedReportContent(validComment)).toBe(false);
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
    expect(prompt).toContain("strengths and areas for development");
    expect(prompt).toContain("Do not name Latin Quest");
    expect(prompt).not.toContain('"averageScore":80');
    expect(prompt).not.toContain('"badges"');
    expect(prompt).not.toContain('"attemptCount"');
  });
});
