export type ActivityAttempt = {
  student_id: string;
  exercise_id: string;
  score_pct: number | null;
  completed_at: string | null;
};

export type PupilActivitySummary = {
  attempts: number;
  bestScore: number | null;
  latestScore: number | null;
  averageScore: number | null;
  lastCompletedAt: string | null;
};

export function summarisePupilAttempts(
  attempts: ActivityAttempt[]
): PupilActivitySummary {
  const completed = attempts
    .filter((attempt) => attempt.completed_at)
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );
  const scores = completed
    .map((attempt) => attempt.score_pct)
    .filter((score): score is number => score != null);

  return {
    attempts: completed.length,
    bestScore: scores.length ? Math.max(...scores) : null,
    latestScore: completed[0]?.score_pct ?? null,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    lastCompletedAt: completed[0]?.completed_at ?? null,
  };
}

export function summariseActivity(
  attempts: ActivityAttempt[],
  pupilCount: number
) {
  const completed = attempts.filter((attempt) => attempt.completed_at);
  const pupilIds = new Set(completed.map((attempt) => attempt.student_id));
  const scores = completed
    .map((attempt) => attempt.score_pct)
    .filter((score): score is number => score != null);

  return {
    pupilsCompleted: pupilIds.size,
    pupilCount,
    completionRate: pupilCount
      ? Math.round((pupilIds.size / pupilCount) * 100)
      : 0,
    totalAttempts: completed.length,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    bestScore: scores.length ? Math.max(...scores) : null,
  };
}
