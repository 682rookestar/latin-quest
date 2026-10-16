import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { parseStudentPasswordStatus, validateNewStudentPassword } from "@/lib/student-password";

describe("temporary pupil passwords", () => {
  it("generates distinct strong secrets with every policy character class", () => {
    const passwords = Array.from({ length: 100 }, generateTemporaryPassword);
    expect(new Set(passwords).size).toBe(100);
    for (const password of passwords) {
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@$%*_-]/);
    }
  });
  it("rejects incomplete or malformed status responses instead of granting access", () => {
    for (const status of [null, [], {}, { required: false }, { required: "false", session_valid: true, expired: false, busy: false }]) {
      expect(parseStudentPasswordStatus(status)).toBeNull();
    }
    expect(parseStudentPasswordStatus({ required: true, session_valid: true, expired: false, busy: false })).toBeNull();
    expect(parseStudentPasswordStatus({ required: false, session_valid: true, expired: false, busy: false })).not.toBeNull();
  });
  it("requires the current secret and a different matching password of sufficient length", () => {
    expect(validateNewStudentPassword("", "New-Password!1234", "New-Password!1234")).toContain("temporary");
    expect(validateNewStudentPassword("Temporary!1234", "short", "short")).toContain("12");
    expect(validateNewStudentPassword("Temporary!1234", "New-Password!1234", "Something-Else!1234")).toContain("match");
    expect(validateNewStudentPassword("Temporary!1234", "Temporary!1234", "Temporary!1234")).toContain("different");
    expect(validateNewStudentPassword("Temporary!1234", "New-Password!1234", "New-Password!1234")).toBeNull();
  });
});
