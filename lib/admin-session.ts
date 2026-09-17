const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

export const ADMIN_SESSION_COOKIE = "lq_admin_session";
export const ADMIN_IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MS;
export const ADMIN_MAX_SESSION_MS = MAX_SESSION_MS;

type AdminSessionStamp = { userId: string; startedAt: number; activeAt: number };

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export async function createAdminSessionStamp(stamp: AdminSessionStamp, secret: string) {
  const payload = `${stamp.userId}.${stamp.startedAt}.${stamp.activeAt}`;
  return `${payload}.${await signature(payload, secret)}`;
}

export async function readAdminSessionStamp(value: string | undefined, secret: string) {
  if (!value) return null;
  const [userId, startedAtValue, activeAtValue, suppliedSignature, ...extra] = value.split(".");
  if (!userId || !startedAtValue || !activeAtValue || !suppliedSignature || extra.length) return null;
  const startedAt = Number(startedAtValue);
  const activeAt = Number(activeAtValue);
  if (!Number.isSafeInteger(startedAt) || !Number.isSafeInteger(activeAt)) return null;
  const payload = `${userId}.${startedAt}.${activeAt}`;
  const expectedSignature = await signature(payload, secret);
  if (suppliedSignature.length !== expectedSignature.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) mismatch |= suppliedSignature.charCodeAt(index) ^ expectedSignature.charCodeAt(index);
  return mismatch === 0 ? { userId, startedAt, activeAt } : null;
}

export function isAdminSessionExpired(stamp: AdminSessionStamp, now = Date.now()) {
  return now < stamp.startedAt || now < stamp.activeAt || now - stamp.activeAt > IDLE_TIMEOUT_MS || now - stamp.startedAt > MAX_SESSION_MS;
}
