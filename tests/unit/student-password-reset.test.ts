import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verifier: null as any }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.verifier }));
vi.mock("@/lib/temporary-password", () => ({ generateTemporaryPassword: () => "Generated-Secret!7294" }));
import { issueTeacherStudentTemporaryPassword } from "@/lib/student-password-reset";

function adminClient() {
  return {
    auth: { admin: {
      getUserById: vi.fn().mockResolvedValue({ data: { user: { id: "pupil", email: "pupil@school.test", email_confirmed_at: "2026-01-01" } }, error: null }),
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    } },
    rpc: vi.fn(async (name: string) => name === "begin_student_password_operation"
      ? { data: { operation_id: "operation", expires_at: "2026-10-17T12:00:00Z" }, error: null }
      : { error: null }),
  };
}
describe("audited temporary password issuance", () => {
  beforeEach(() => {
    mocks.verifier = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "pupil" }, session: { access_token: "server-only-token" } }, error: null }) } };
  });
  it("reveals the generated password only after Auth update, global session revocation and audit completion", async () => {
    const admin = adminClient();
    const result = await issueTeacherStudentTemporaryPassword(admin as any, { id: "pupil", email: "pupil@school.test" }, "teacher");
    expect(result).toMatchObject({ ok: true, temporaryPassword: "Generated-Secret!7294" });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith("pupil", { password: result.temporaryPassword });
    expect(admin.auth.admin.signOut).toHaveBeenCalledWith("server-only-token", "global");
    expect(admin.rpc).toHaveBeenLastCalledWith("finish_student_password_operation", { p_student: "pupil", p_operation_id: "operation", p_success: true });
    expect(JSON.stringify(admin.rpc.mock.calls)).not.toContain(result.temporaryPassword);
  });
  it("does not change an unverified or mismatched sign-in account", async () => {
    const admin = adminClient();
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { id: "pupil", email: "someone-else@school.test", email_confirmed_at: "2026-01-01" } }, error: null });
    expect((await issueTeacherStudentTemporaryPassword(admin as any, { id: "pupil", email: "pupil@school.test" }, "teacher")).ok).toBe(false);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("does not reveal a password when revocation fails and keeps the change required", async () => {
    const admin = adminClient();
    admin.auth.admin.signOut.mockResolvedValue({ error: { message: "unavailable" } } as any);
    const result = await issueTeacherStudentTemporaryPassword(admin as any, { id: "pupil", email: "pupil@school.test" }, "teacher");
    expect(result.ok).toBe(false);
    expect(result.temporaryPassword).toBeUndefined();
    expect(admin.rpc).toHaveBeenLastCalledWith("finish_student_password_operation", { p_student: "pupil", p_operation_id: "operation", p_success: false });
  });
  it("does not mutate Auth when the database lease or required audit cannot be created", async () => {
    const admin = adminClient();
    admin.rpc.mockResolvedValue({ data: null, error: { message: "password_operation_busy" } } as any);
    expect((await issueTeacherStudentTemporaryPassword(admin as any, { id: "pupil", email: "pupil@school.test" }, "teacher")).ok).toBe(false);
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
