import { describe, expect, it } from "vitest";
import {
  summariseActivity,
  summarisePupilAttempts,
} from "@/lib/activity-analytics";

const attempts = [
  {
    student_id: "one",
    exercise_id: "activity",
    score_pct: 60,
    completed_at: "2026-09-20T10:00:00Z",
  },
  {
    student_id: "one",
    exercise_id: "activity",
    score_pct: 80,
    completed_at: "2026-09-21T10:00:00Z",
  },
  {
    student_id: "two",
    exercise_id: "activity",
    score_pct: 100,
    completed_at: "2026-09-22T10:00:00Z",
  },
  {
    student_id: "two",
    exercise_id: "activity",
    score_pct: null,
    completed_at: null,
  },
];

describe("teacher activity analytics", () => {
  it("summarises repeat attempts without counting unfinished work", () => {
    expect(summarisePupilAttempts(attempts.slice(0, 2))).toEqual({
      attempts: 2,
      bestScore: 80,
      latestScore: 80,
      averageScore: 70,
      lastCompletedAt: "2026-09-21T10:00:00Z",
    });
  });

  it("calculates class completion from unique pupils", () => {
    expect(summariseActivity(attempts, 4)).toEqual({
      pupilsCompleted: 2,
      pupilCount: 4,
      completionRate: 50,
      totalAttempts: 3,
      averageScore: 80,
      bestScore: 100,
    });
  });
});
