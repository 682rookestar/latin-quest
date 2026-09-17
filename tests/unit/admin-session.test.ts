import { describe, expect, it } from "vitest";
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_MAX_SESSION_MS, createAdminSessionStamp, isAdminSessionExpired, readAdminSessionStamp } from "../../lib/admin-session";

describe("administrator session controls", () => {
  const secret = "a-test-secret-that-is-not-used-in-production";
  const stamp = { userId: "admin-id", startedAt: 1_000_000, activeAt: 1_100_000 };

  it("accepts an authentic signed stamp", async () => {
    const value = await createAdminSessionStamp(stamp, secret);
    await expect(readAdminSessionStamp(value, secret)).resolves.toEqual(stamp);
  });

  it("rejects a stamp whose activity time was altered", async () => {
    const value = await createAdminSessionStamp(stamp, secret);
    await expect(readAdminSessionStamp(value.replace("1100000", "1200000"), secret)).resolves.toBeNull();
  });

  it("expires idle and overlong sessions", () => {
    expect(isAdminSessionExpired(stamp, stamp.activeAt + ADMIN_IDLE_TIMEOUT_MS + 1)).toBe(true);
    expect(isAdminSessionExpired(stamp, stamp.startedAt + ADMIN_MAX_SESSION_MS + 1)).toBe(true);
    expect(isAdminSessionExpired(stamp, stamp.activeAt + 1_000)).toBe(false);
  });
});
