import { randomInt } from "node:crypto";

/** A fresh 16-character secret, with each common Supabase policy class present. */
export function generateTemporaryPassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@$%*-_"];
  const alphabet = groups.join("");
  const chars = groups.map(group => group[randomInt(group.length)]);
  while (chars.length < 16) chars.push(alphabet[randomInt(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
