import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { checkAnswer } from "@/app/learn/actions";

function query(data: unknown) {
  const chain: any = { select: () => chain, eq: () => chain, limit: () => chain,
    single: async () => ({ data }), maybeSingle: async () => ({ data }) };
  return chain;
}

describe("exercise marking failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.server.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "pupil" } } }) },
      from: (table: string) => query(table === "profiles" ? { role: "student" } : table === "class_members" ? { class_id: "class" } : { id: "exercise", chapter_id: "chapter", is_boss: false }),
      rpc: async () => ({ data: [] }),
    });
  });

  it("does not mark an answer wrong when rate limiting prevents checking", async () => {
    mocks.admin.mockReturnValue({ rpc: async () => ({ data: false }) });
    const result = await checkAnswer("exercise", "question", "puella");
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("is_correct");
  });

  it("does not mark an answer wrong when its question cannot be loaded", async () => {
    mocks.admin.mockReturnValue({ rpc: async () => ({ data: true }), from: () => query(null) });
    const result = await checkAnswer("exercise", "question", "puella");
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("is_correct");
  });

  it("still marks a successfully loaded correct answer correctly", async () => {
    mocks.admin.mockReturnValue({ rpc: async () => ({ data: true }), from: () => query({ exercise_id: "exercise", correct_answer: "puella", metadata: {}, exercises: { game_type: "multiple_choice", chapter_id: "chapter", is_boss: false } }) });
    expect(await checkAnswer("exercise", "question", "puella")).toEqual({ is_correct: true, correct_answer: "puella" });
  });
});
