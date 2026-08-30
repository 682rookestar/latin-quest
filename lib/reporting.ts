export type ReportingEvidence = {
  period: { name: string; startsOn: string; endsOn: string };
  attemptCount: number;
  averageScore: number | null;
  questionsAnswered: number;
  questionsCorrect: number;
  practiceDays: number;
  firstActivity: string | null;
  lastActivity: string | null;
  strongestChapter: string | null;
  developmentChapter: string | null;
  chapterBreakdown: Array<{
    chapter: string;
    attempts: number;
    questions: number;
    correct: number;
    accuracy: number;
  }>;
  skillBreakdown: Array<{
    skill: string;
    attempts: number;
    correct: number;
    accuracy: number;
    mastery: number;
  }>;
  badges: string[];
};

export type ReportInputs = {
  bflEngagement: number | null;
  bflClasswork: number | null;
  bflIndependentStudy: number | null;
  progressGrade: number | null;
  lessonObservations: string;
  strengths: string;
  improvementTargets: string;
  schoolValues: string;
  beneNotes: string;
};

export type StyleCheck = {
  level: "error" | "warning" | "pass";
  message: string;
};

const contractions = /\b(?:can't|cannot've|couldn't|didn't|doesn't|don't|hadn't|hasn't|haven't|he's|I'd|I'll|I'm|isn't|it's|she's|shouldn't|they're|wasn't|weren't|we're|won't|wouldn't|you'll|you're)\b/i;
const wellWishingEnding = /(?:good luck|well done|keep it up|best wishes|for the future|next year)[.!\s]*$/i;
const excludedReportContent = /(?:\d+(?:\.\d+)?\s*%|\b(?:badge|badges|website|platform)\b|\bLatin Quest\b)/i;

export function containsExcludedReportContent(comment: string) {
  return excludedReportContent.test(comment);
}

export function checkHallifordStyle(comment: string, preferredName: string): StyleCheck[] {
  const text = comment.trim();
  const checks: StyleCheck[] = [];
  const length = text.length;

  checks.push(
    length >= 300 && length <= 1200
      ? { level: "pass", message: `${length} characters (required: 300-1,200).` }
      : { level: "error", message: `${length} characters; Halliford requires 300-1,200.` }
  );
  checks.push(
    preferredName && new RegExp(`\\b${escapeRegExp(preferredName)}\\b`, "i").test(text)
      ? { level: "pass", message: "Uses the pupil's preferred name." }
      : { level: "warning", message: "Use the pupil's preferred name in the comment." }
  );
  checks.push(
    /\b(?:improve|develop|focus|target|should|needs? to|next step)\b/i.test(text)
      ? { level: "pass", message: "Includes a tangible development point." }
      : { level: "warning", message: "Add a tangible action for improvement." }
  );
  if (contractions.test(text)) {
    checks.push({ level: "warning", message: "Remove contractions to match Halliford grammar rules." });
  }
  if (wellWishingEnding.test(text)) {
    checks.push({ level: "warning", message: "Remove the well-wishing sentence at the end." });
  }
  if ((text.match(/!/g) ?? []).length > 1) {
    checks.push({ level: "warning", message: "Avoid overusing exclamation marks." });
  }
  if (/\bhard[- ]working\b/i.test(text)) {
    checks.push({ level: "warning", message: "Use 'hardworking' as one word." });
  }
  if (/\byear\s+[7-9]\b/.test(text)) {
    checks.push({ level: "warning", message: "Capitalise year groups, for example 'Year 7'." });
  }
  if (containsExcludedReportContent(text)) {
    checks.push({ level: "warning", message: "Remove percentages, badges and references to the learning platform." });
  }
  if (!checks.some((check) => check.level === "warning" || check.level === "error")) {
    checks.push({ level: "pass", message: "No additional Halliford house-style issues found." });
  }
  return checks;
}

export function buildReportPrompt({
  preferredName,
  className,
  evidence,
}: {
  preferredName: string;
  className: string;
  evidence: ReportingEvidence;
  inputs: ReportInputs;
}) {
  const rankedSkills = [...evidence.skillBreakdown]
    .filter((skill) => skill.attempts > 0)
    .sort((a, b) => b.accuracy - a.accuracy);
  const strengthSkills = rankedSkills.slice(0, 3).map((skill) => skill.skill);
  const developmentSkills = rankedSkills
    .slice(-3)
    .map((skill) => skill.skill)
    .filter((skill) => !strengthSkills.includes(skill));
  const qualitativeEvidence = {
    strongestChapter: evidence.strongestChapter,
    developmentChapter: evidence.developmentChapter,
    strengthSkills,
    developmentSkills,
  };

  return `Write a Halliford School Latin subject report comment for ${preferredName}.

Use only the supplied qualitative learning evidence. Focus exclusively on the pupil's strengths and areas for development. Do not invent personality, classroom behaviour, pastoral circumstances, awards, school values, assessment results or improvement claims. Do not mention email addresses or technical identifiers.

Required style:
- 300 to 1,200 characters including spaces.
- Professional, warm, specific British English.
- Mix ${preferredName}'s name with suitable pronouns; do not over-repeat the name.
- Give balanced coverage to concrete strengths and clear areas for development.
- Do not include percentages, scores, grades, activity totals, question totals, mastery numbers or badges.
- Do not refer to the amount or frequency of practice.
- Do not name Latin Quest, a website, an app, a platform or any learning software.
- Do not use contractions or exclamation marks.
- Do not end with a well-wishing sentence or fragment.
- Use 'homework', 'hardworking', 'Year 7', 'Progress Grade' and 'Challenge Grade' exactly if relevant.
- Do not describe this as an AI draft or list raw fields.

Class: ${className}
Reporting period: ${evidence.period.name}, ${evidence.period.startsOn} to ${evidence.period.endsOn}
Qualitative subject evidence: ${JSON.stringify(qualitativeEvidence)}

Return only the finished report comment.`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
