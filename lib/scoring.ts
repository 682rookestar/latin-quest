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

function stemWord(word: string): string {
  return word
    .replace(/(?:ing|tion|ness|ment)$/, "")
    .replace(/(?:ed|er|est|ly)$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "")
    .replace(/e$/, "");
}

export function answersMatch(student: string, correct: string): boolean {
  return normaliseAnswer(student) === normaliseAnswer(correct);
}

export function translationMatches(student: string, correct: string): boolean {
  const submitted = normaliseAnswer(student);
  const expected = normaliseAnswer(correct);
  if (!submitted) return false;
  if (submitted === expected) return true;

  const studentWords = submitted.split(" ");
  const expectedKeywords = expected.split(" ").filter((word) => word.length > 3);
  if (studentWords.length < Math.ceil(expectedKeywords.length * 0.5)) return false;

  const uniqueRatio = new Set(studentWords).size / studentWords.length;
  if (studentWords.length > 3 && uniqueRatio < 0.6) return false;

  const studentStems = new Set(studentWords.map(stemWord));
  const hits = expectedKeywords.filter((word) => studentStems.has(stemWord(word))).length;
  return expectedKeywords.length > 0 && hits / expectedKeywords.length >= 0.8;
}

export function scoreAnswer(
  studentAnswer: string,
  correctAnswer: string,
  gameType: string,
  metadata: unknown
): boolean {
  if (studentAnswer.length > 5000) return false;

  if (gameType === "word_type_sort") {
    const details = metadata as { words?: { word: string; type: string }[] } | null;
    const items = details?.words ?? [];
    if (!items.length) return false;

    let submitted: Record<string, string> = {};
    try {
      submitted = JSON.parse(studentAnswer);
    } catch {
      return false;
    }
    return items.every((item) => submitted[item.word] === item.type);
  }

  if (gameType === "translation") {
    return translationMatches(studentAnswer, correctAnswer);
  }
  return answersMatch(studentAnswer, correctAnswer);
}
