import { translationAlternatives } from "./translation-answers";

export function normaliseAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["“”'‘’„«»!?.,;:()\[\]{}/\\—–\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function answersMatch(student: string, correct: string): boolean {
  return normaliseAnswer(student) === normaliseAnswer(correct);
}

function normaliseTranslation(value: string): string {
  // Latin has no articles. Ignore English article choices, but preserve word
  // order, pronouns, negation, tense and number: these change the meaning.
  const expanded = value.replace(/[’‘]/g, "'")
    .replace(/\bdidn't\b/gi, "did not").replace(/\bdoesn't\b/gi, "does not")
    .replace(/\bdon't\b/gi, "do not").replace(/\bwasn't\b/gi, "was not")
    .replace(/\bweren't\b/gi, "were not").replace(/\bisn't\b/gi, "is not")
    .replace(/\baren't\b/gi, "are not").replace(/\bhasn't\b/gi, "has not")
    .replace(/\bhaven't\b/gi, "have not").replace(/\bhadn't\b/gi, "had not")
    .replace(/\bI'm\b/gi, "I am");
  return normaliseAnswer(expanded).split(" ").filter(word => !["a", "an", "the"].includes(word)).join(" ");
}

export function translationMatches(student: string, correct: string, alternatives: string[] = []): boolean {
  const submitted = normaliseTranslation(student);
  if (!submitted) return false;
  const curated = translationAlternatives[correct] ?? [];
  return [correct, ...curated, ...alternatives].some(candidate => normaliseTranslation(candidate) === submitted);
}

export type AnswerScore = {
  isCorrect: boolean;
  earned: number;
  possible: number;
};

export function scoreAnswerDetails(
  studentAnswer: string,
  correctAnswer: string,
  gameType: string,
  metadata: unknown
): AnswerScore {
  if (studentAnswer.length > 5000) return { isCorrect: false, earned: 0, possible: 1 };

  if (gameType === "word_type_sort") {
    const details = metadata as { words?: { word: string; type: string }[] } | null;
    const items = details?.words ?? [];
    if (!Array.isArray(items) || !items.length || items.some(item =>
      !item || typeof item.word !== "string" || typeof item.type !== "string"
    )) return { isCorrect: false, earned: 0, possible: 1 };

    let submitted: Record<string, string> = {};
    try {
      submitted = JSON.parse(studentAnswer);
    } catch {
      return { isCorrect: false, earned: 0, possible: items.length };
    }
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
      return { isCorrect: false, earned: 0, possible: items.length };
    }
    const earned = items.filter((item) =>
      Object.hasOwn(submitted, item.word) && submitted[item.word] === item.type
    ).length;
    return { isCorrect: earned === items.length, earned, possible: items.length };
  }

  const isCorrect = gameType === "translation"
    ? (() => {
        const candidates = (metadata as { accepted_answers?: unknown } | null)?.accepted_answers;
        const alternatives = Array.isArray(candidates) ? candidates.filter((value): value is string => typeof value === "string") : [];
        return translationMatches(studentAnswer, correctAnswer, alternatives);
      })()
    : answersMatch(studentAnswer, correctAnswer);
  return { isCorrect, earned: isCorrect ? 1 : 0, possible: 1 };
}

export function scoreAnswer(
  studentAnswer: string,
  correctAnswer: string,
  gameType: string,
  metadata: unknown
): boolean {
  return scoreAnswerDetails(studentAnswer, correctAnswer, gameType, metadata).isCorrect;
}
