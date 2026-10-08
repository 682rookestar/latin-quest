import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  regularClient: null as any,
  adminClient: null as any,
  hasAal2: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mocks.regularClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.adminClient,
}));
vi.mock("@/lib/auth-security", () => ({
  hasAal2: mocks.hasAal2,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { resetTeacherStudentPassword } from "@/app/teacher/admin/actions";

function form(studentId = "student-1") {
  const data = new FormData();
  data.set("student_id", studentId);
  return data;
}

function regularTeacherClient() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "teacher-1", email: "teacher@school.test" } } }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { role: "teacher", disabled_at: null } }),
        })),
      })),
    })),
  };
}

function adminClient({ ownsStudent }: { ownsStudent: boolean }) {
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: "hashed-token" } },
    error: null,
  });
  const auditInsertSingle = vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null });
  const auditUpdateEq = vi.fn().mockResolvedValue({ error: null });

  const client = {
    auth: { admin: { generateLink } },
    from: vi.fn((table: string) => {
      if (table === "classes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({ data: [{ id: "class-1" }], error: null }),
            })),
          })),
        };
      }
      if (table === "class_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: ownsStudent ? { student_id: "student-1" } : null,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "student-1",
                  email: "pupil@school.test",
                  display_name: "Test Pupil",
                  role: "student",
                  disabled_at: null,
                },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "student_account_audit") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: auditInsertSingle })),
          })),
          update: vi.fn(() => ({ eq: auditUpdateEq })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, generateLink };
}

describe("teacher pupil password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://latin-quest.test";
    mocks.regularClient = regularTeacherClient();
    mocks.hasAal2.mockResolvedValue(true);
  });

  it("refuses a pupil outside the teacher's own classes", async () => {
    const admin = adminClient({ ownsStudent: false });
    mocks.adminClient = admin.client;

    const result = await resetTeacherStudentPassword(null, form());

    expect(result.ok).toBe(false);
    expect(result.message).toContain("your active classes");
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it("requires teacher MFA before using the privileged client", async () => {
    const admin = adminClient({ ownsStudent: true });
    mocks.adminClient = admin.client;
    mocks.hasAal2.mockResolvedValue(false);

    const result = await resetTeacherStudentPassword(null, form());

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Two-factor authentication");
    expect(admin.client.from).not.toHaveBeenCalled();
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it("creates an audited one-time recovery link for an owned pupil", async () => {
    const admin = adminClient({ ownsStudent: true });
    mocks.adminClient = admin.client;

    const result = await resetTeacherStudentPassword(null, form());

    expect(result).toEqual({
      ok: true,
      message: "One-time recovery link created for pupil@school.test.",
      recoveryLink: "https://latin-quest.test/auth/confirm?token_hash=hashed-token&type=recovery&next=/account",
    });
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "pupil@school.test",
      options: { redirectTo: "https://latin-quest.test/account" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/teacher/admin");
  });
});
