import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: null as any, admin: null as any, verifier: null as any, revoke: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.admin }));
vi.mock("@/lib/student-password-reset", () => ({
  createPasswordVerificationClient: () => mocks.verifier,
  revokeStudentPasswordSessions: mocks.revoke,
  passwordOperationMessage: (message: string) => message,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { completeStudentPasswordChange } from "@/app/account/change-password/actions";

function form() {
  const data = new FormData();
  data.set("temporary_password", "Temporary-Only!7294");
  data.set("password", "My-New-Password!8294");
  data.set("confirm_password", "My-New-Password!8294");
  data.set("student_id", "someone-else");
  return data;
}
describe("pupil mandatory password change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
    mocks.revoke.mockResolvedValue(undefined);
    mocks.client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "signed-in-pupil", email: "pupil@school.test" } }, error: null }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }) },
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "student", disabled_at: null } }) }) }) })),
      rpc: vi.fn().mockResolvedValue({ data: { required: true, session_valid: true, expired: false, busy: false, reset_id: "reset-1", expires_at: "2026-10-17T12:00:00Z" }, error: null }),
    };
    mocks.admin = {
      auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
      rpc: vi.fn(async (_name: string, args: any) => args.p_operation === "complete" ? { data: { operation_id: "op-1" }, error: null } : { data: {}, error: null }),
    };
    mocks.verifier = { auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "signed-in-pupil" } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    } };
  });
  it("uses the authenticated pupil, not a submitted account id, and only clears the gate after secure completion", async () => {
    await expect(completeStudentPasswordChange(null, form())).rejects.toThrow("REDIRECT:/learn?password=changed");
    expect(mocks.admin.auth.admin.updateUserById).toHaveBeenCalledWith("signed-in-pupil", { password: "My-New-Password!8294" });
    expect(mocks.admin.rpc).toHaveBeenLastCalledWith("finish_student_password_operation", { p_student: "signed-in-pupil", p_operation_id: "op-1", p_success: true });
    expect(JSON.stringify(mocks.admin.rpc.mock.calls)).not.toContain("Temporary-Only!7294");
    expect(JSON.stringify(mocks.admin.rpc.mock.calls)).not.toContain("someone-else");
  });
  it("rejects wrong temporary credentials without updating Auth or completing a reset", async () => {
    mocks.verifier.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "invalid" } });
    expect((await completeStudentPasswordChange(null, form()))?.error).toContain("not correct");
    expect(mocks.admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("cannot bypass an existing authenticator factor", async () => {
    mocks.client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect((await completeStudentPasswordChange(null, form()))?.error).toContain("authenticator");
    expect(mocks.admin.rpc).not.toHaveBeenCalled();
  });
  it("rejects expired or revoked sessions before password verification", async () => {
    const response = await mocks.client.rpc();
    response.data.expired = true;
    expect((await completeStudentPasswordChange(null, form()))?.error).toContain("expired");
    expect(mocks.verifier.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("a concurrent reset cannot be cleared by a stale password-change request", async () => {
    mocks.admin.rpc.mockImplementation(async (_name: string, args: any) => args.p_operation === "complete"
      ? { data: null, error: { message: "password_reset_changed" } } : { data: {}, error: null });
    expect((await completeStudentPasswordChange(null, form()))?.error).toContain("changed");
    expect(mocks.admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
