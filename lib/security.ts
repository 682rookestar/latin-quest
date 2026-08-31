const DEFAULT_REDIRECT_PATH = "/dashboard";

/**
 * Resolve an authentication redirect without allowing the destination to
 * leave this application. Authentication links are attacker-controlled input,
 * so concatenating `origin + next` is not safe (for example, `@evil.test`).
 */
export function safeRedirectUrl(
  origin: string,
  next: string | null,
  fallback = DEFAULT_REDIRECT_PATH
): URL {
  const fallbackUrl = new URL(fallback, `${origin}/`);

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallbackUrl;
  }

  try {
    const candidate = new URL(next, `${origin}/`);
    return candidate.origin === fallbackUrl.origin ? candidate : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

type JsonObject = Record<string, unknown>;

/**
 * Return only metadata that is required to render a question in the browser.
 * In particular, word-sort metadata contains the answer beside each word in
 * the database; those `type` values must never cross the server boundary.
 */
export function publicQuestionMetadata(
  metadata: unknown,
  gameType: string
): JsonObject | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const source = metadata as JsonObject;

  if (gameType === "word_type_sort") {
    const words = Array.isArray(source.words)
      ? source.words
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            const word = (item as JsonObject).word;
            return typeof word === "string" ? { word } : null;
          })
          .filter((item): item is { word: string } => item !== null)
      : [];
    const types = Array.isArray(source.types)
      ? source.types.filter((item): item is string => typeof item === "string")
      : [];

    return { words, types };
  }

  if (gameType === "preposition_picture") {
    return {
      ...(typeof source.svg === "string" ? { svg: source.svg } : {}),
      ...(typeof source.caption === "string" ? { caption: source.caption } : {}),
    };
  }

  // Metadata for future game types is private by default. New fields must be
  // reviewed and explicitly allow-listed before they are sent to pupils.
  return null;
}
