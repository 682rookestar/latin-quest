import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), save: vi.fn(), locked: false, lockError: false, sourceId: "exercise" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { submitExercise as submit, checkAnswer } from "@/app/learn/actions";
import { issueExerciseTicket } from "@/lib/exercise-ticket";
const submitExercise = (id: string, answers: any, ticket = issueExerciseTicket("signed-in-pupil", "exercise", ["q1"])) => submit(id, answers, ticket);

function query(data: unknown) {
  const chain: any = { select: () => chain, eq: () => chain, limit: () => chain,
    single: async () => ({ data }), maybeSingle: async () => ({ data }) };
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only-signing-key");
  mocks.locked = false; mocks.lockError = false; mocks.sourceId = "exercise";
  mocks.server.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "signed-in-pupil" } } }) },
    from: (table: string) => query(table === "profiles" ? { role: "student" } : table === "class_members" ? { class_id: "class" } : { id: "exercise", chapter_id: "chapter", is_boss: false }),
    rpc: async () => ({ data: mocks.lockError ? null : mocks.locked ? [{ chapter_id: "chapter" }] : [], error: mocks.lockError ? { message: "database unavailable" } : null }),
  });
  const question = () => ({ id: "q1", exercise_id: mocks.sourceId, correct_answer: "puella", metadata: {}, exercises: { game_type: "multiple_choice", chapter_id: "chapter", is_boss: false } });
  mocks.save.mockReturnValue({ single: async () => ({ data: { score_pct: 100, correct: 1, total: 1, badge_earned: false } }) });
  mocks.admin.mockReturnValue({
    rpc: (name: string, args: unknown) => name === "consume_exercise_rate_limit" ? Promise.resolve({ data: true }) : mocks.save(name, args),
    from: () => ({ select: () => ({ in: async () => ({ data: [question()] }), eq: () => query(question()) }) }),
  });
});

afterEach(() => vi.unstubAllEnvs());
describe("submission tampering audit (mock database, no live writes)", () => {
  it("ignores forged pupil identity and correctness fields", async () => {
    await submitExercise("exercise", [{ question_id: "q1", student_answer: "wrong", is_correct: true, student_id: "another-pupil", score_pct: 100 } as any]);
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ p_student: "signed-in-pupil", p_answers: [{ question_id: "q1", student_answer: "wrong", is_correct: false }] });
  });
  it("rejects questions belonging to another exercise", async () => {
    mocks.sourceId = "other-exercise";
    await expect(submitExercise("exercise", [{ question_id: "q1", student_answer: "puella" }])).rejects.toThrow("Could not load questions");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects duplicate question IDs", async () => {
    await expect(submitExercise("exercise", Array(2).fill({ question_id: "q1", student_answer: "puella" }))).rejects.toThrow("Invalid answers");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects a locked chapter", async () => {
    mocks.locked = true;
    await expect(submitExercise("exercise", [{ question_id: "q1", student_answer: "puella" }])).rejects.toThrow("Not authorised");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  // Ticket checks are unit-tested; atomic retry behavior is verified in Docker.
  it("rejects a partial completion of an issued question set", async () => {
    const ticket = issueExerciseTicket("signed-in-pupil", "exercise", ["q1", "q2"]);
    await expect(submitExercise("exercise", [{ question_id: "q1", student_answer: "puella" }], ticket)).rejects.toThrow("Invalid or expired");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("passes the same stable receipt ID on repeated submission (atomic deduplication is database-tested)", async () => {
    const answers = [{ question_id: "q1", student_answer: "puella" }];
    const ticket = issueExerciseTicket("signed-in-pupil", "exercise", ["q1"]);
    await submitExercise("exercise", answers, ticket);
    await submitExercise("exercise", answers, ticket);
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[0][0]).toBe("submit_exercise_attempt_once");
    expect(mocks.save.mock.calls[0][1].p_ticket).toBe(mocks.save.mock.calls[1][1].p_ticket);
  });
  it("fails closed when the chapter lock lookup fails", async () => {
    mocks.lockError = true;
    expect(await checkAnswer("exercise", "q1", "puella")).toHaveProperty("error");
    await expect(submitExercise("exercise", [{ question_id: "q1", student_answer: "puella" }])).rejects.toThrow("Not authorised");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([null, {}, [null], [{ question_id: "q1", student_answer: {} }]])("rejects malformed submission input %j", async input => {
    await expect(submitExercise("exercise", input as any)).rejects.toThrow("Invalid answers");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
