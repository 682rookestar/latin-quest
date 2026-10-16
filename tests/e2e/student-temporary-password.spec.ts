import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:55321";
const PASSWORD = "Local-Password-QA!7294";
const NEW_PASSWORD = "Pupil-Own-Password!8294";
const EXERCISE = "/learn/chapter/10000000-0000-4000-8000-000000000001/exercise/40000000-0000-4000-8000-000000000001";
const suffix = randomUUID().slice(0, 8);
const teacherEmail = `qa.password.teacher.${suffix}@hallifordschool.co.uk`;
const studentEmail = `qa.password.pupil.${suffix}@hallifordschool.co.uk`;
let admin: SupabaseClient;
let anonKey: string;
let teacherId: string;
let studentId: string;
let otherTeacherId: string;
let secret: string;
let classId: string;
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

function totp(base32: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...base32.toUpperCase().replace(/=+$/, "")].map(char => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
function pupilClient() {
  return createClient(API, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("email", { exact: true }).fill(email);
  await page.getByPlaceholder("password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function teacherLogin(page: Page) {
  await login(page, teacherEmail, PASSWORD);
  await expect(page.getByRole("heading", { name: "Enter your authenticator code" })).toBeVisible();
  await page.getByRole("textbox", { name: "Authenticator code" }).fill(totp(secret));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/admin");
}
async function reset(page: Page, email = studentEmail) {
  const row = page.getByRole("listitem").filter({ hasText: email });
  page.once("dialog", dialog => dialog.accept());
  await row.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(row.getByTestId("temporary-password")).toBeVisible();
  return (await row.getByTestId("temporary-password").innerText()).trim();
}

test.beforeAll(async ({ browser }) => {
  const status = JSON.parse(execFileSync("npx", ["--yes", "supabase@2.117.0", "status", "--workdir", "tests/local", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  if (status.API_URL !== API) throw new Error("Refusing non-local password QA backend");
  anonKey = status.ANON_KEY;
  admin = createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  async function user(email: string, role: string) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `Password QA ${role}` } });
    if (error || !data.user) throw error ?? new Error("Missing synthetic user");
    const update = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (update.error) throw update.error;
    return data.user.id;
  }
  teacherId = await user(teacherEmail, "teacher");
  otherTeacherId = await user(`qa.password.other.${suffix}@hallifordschool.co.uk`, "teacher");
  studentId = await user(studentEmail, "student");
  classId = randomUUID();
  const klass = await admin.from("classes").insert({ id: classId, name: `Password QA ${suffix}`, teacher_id: teacherId, join_code: `PW${suffix.toUpperCase()}` });
  if (klass.error) throw klass.error;
  const membership = await admin.from("class_members").insert({ class_id: classId, student_id: studentId });
  if (membership.error) throw membership.error;
  // Synthetic pre-existing learning history: resetting a password must not
  // delete or rewrite any of these records.
  for (const result of await Promise.all([
    admin.from("attempts").insert({ student_id: studentId, exercise_id: "40000000-0000-4000-8000-000000000001", score_pct: 80, total_questions: 20, correct_questions: 16, completed_at: new Date().toISOString() }),
    admin.from("skill_progress").insert({ student_id: studentId, chapter_id: "10000000-0000-4000-8000-000000000001", skill_id: "20000000-0000-4000-8000-000000000001", attempts: 20, correct: 16, mastery: 80 }),
    admin.from("chapter_badges").insert({ student_id: studentId, chapter_id: "10000000-0000-4000-8000-000000000001" }),
  ])) if (result.error) throw result.error;
  // Enrol and verify teacher MFA through the real UI, without an auth bypass.
  const page = await browser.newPage();
  await login(page, teacherEmail, PASSWORD);
  await expect(page.getByRole("button", { name: "Set up authenticator" })).toBeVisible();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await page.getByText("Can't scan the code?", { exact: true }).click();
  secret = (await page.locator("details code").innerText()).trim();
  await page.getByRole("textbox", { name: "Authenticator code" }).fill(totp(secret));
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await page.close();
  mkdirSync(".codex-artifacts/password-reset", { recursive: true });
});

test("teacher resets an owned pupil, pupil must replace the temporary password, and old credentials/sessions cannot access learning", async ({ page, browser }) => {
  const oldClient = pupilClient();
  const oldLogin = await oldClient.auth.signInWithPassword({ email: studentEmail, password: PASSWORD });
  expect(oldLogin.error).toBeNull();
  await teacherLogin(page);
  const temporary = await reset(page);
  expect(temporary).toHaveLength(16);
  await page.screenshot({ path: ".codex-artifacts/password-reset/teacher-reset.png", fullPage: true, mask: [page.getByTestId("temporary-password")] });
  expect((await pupilClient().auth.signInWithPassword({ email: studentEmail, password: PASSWORD })).error).not.toBeNull();
  expect((await oldClient.from("class_members").select("class_id").eq("student_id", studentId)).data).toEqual([]);

  const pupilPage = await browser.newPage();
  await login(pupilPage, studentEmail, temporary);
  await expect(pupilPage).toHaveURL(/\/account\/change-password$/);
  await pupilPage.goto(EXERCISE);
  await expect(pupilPage).toHaveURL(/\/account\/change-password$/);
  await pupilPage.screenshot({ path: ".codex-artifacts/password-reset/password-required.png", fullPage: true });
  const temporaryClient = pupilClient();
  expect((await temporaryClient.auth.signInWithPassword({ email: studentEmail, password: temporary })).error).toBeNull();
  expect((await temporaryClient.from("class_members").select("class_id").eq("student_id", studentId)).data).toEqual([]);
  const forbidden = await temporaryClient.rpc("begin_student_password_operation", { p_student: studentId, p_actor: teacherId, p_operation: "issue", p_reset: null });
  expect(forbidden.error).not.toBeNull();
  for (const rpc of ["get_standard_progress", "get_class_leaderboard", "locked_chapters_for_me"]) {
    expect((await temporaryClient.rpc(rpc)).error?.message).toContain("password_change_required");
  }
  expect((await temporaryClient.rpc("join_class_by_code", { p_code: "NOT-A-CODE" })).error?.message).toContain("password_change_required");

  await pupilPage.getByLabel("Temporary password from your teacher").fill("Wrong-Temporary!7294");
  await pupilPage.getByLabel("Your new password", { exact: true }).fill(NEW_PASSWORD);
  await pupilPage.getByLabel("Confirm your new password").fill(NEW_PASSWORD);
  await pupilPage.getByRole("button", { name: "Save my new password" }).click();
  await expect(pupilPage.getByRole("alert").filter({ hasText: "not correct" })).toBeVisible();
  await pupilPage.getByLabel("Temporary password from your teacher").fill(temporary);
  await pupilPage.getByLabel("Your new password", { exact: true }).fill(NEW_PASSWORD);
  await pupilPage.getByLabel("Confirm your new password").fill(NEW_PASSWORD);
  await pupilPage.getByRole("button", { name: "Save my new password" }).click();
  await expect(pupilPage).toHaveURL(/\/learn\?password=changed$/);
  expect((await pupilClient().auth.signInWithPassword({ email: studentEmail, password: temporary })).error).not.toBeNull();
  expect((await temporaryClient.from("class_members").select("class_id").eq("student_id", studentId)).data).toEqual([]);
  const freshClient = pupilClient();
  expect((await freshClient.auth.signInWithPassword({ email: studentEmail, password: NEW_PASSWORD })).error).toBeNull();
  expect((await freshClient.rpc("student_password_status")).data).toMatchObject({ required: false, session_valid: true });
  expect((await freshClient.from("class_members").select("class_id").eq("student_id", studentId)).data).toHaveLength(1);
  const history = await freshClient.from("attempts").select("score_pct,total_questions,correct_questions").eq("student_id", studentId);
  expect(history.error).toBeNull();
  expect(history.data).toEqual([{ score_pct: 80, total_questions: 20, correct_questions: 16 }]);
  const mastery = await freshClient.from("skill_progress").select("attempts,correct,mastery").eq("student_id", studentId);
  expect(mastery.error).toBeNull();
  expect(mastery.data).toEqual([{ attempts: 20, correct: 16, mastery: 80 }]);
  expect((await freshClient.from("chapter_badges").select("chapter_id").eq("student_id", studentId)).data).toHaveLength(1);
  await pupilPage.goto(EXERCISE);
  for (let question = 1; question <= 20; question++) {
    await expect(pupilPage.getByText(`Question ${question} of 20`, { exact: true })).toBeVisible();
    await pupilPage.getByRole("button", { name: "girl", exact: true }).click();
    await pupilPage.getByRole("button", { name: "Check", exact: true }).click();
    await expect(pupilPage.getByText("Correct", { exact: true })).toBeVisible();
    await pupilPage.getByRole("button", { name: question === 20 ? "Finish" : "Next", exact: true }).click();
  }
  await expect(pupilPage.getByText("20 of 20 correct", { exact: true })).toBeVisible();
  const saved = await freshClient.from("attempts").select("score_pct,total_questions,correct_questions").eq("student_id", studentId).order("score_pct");
  expect(saved.data).toEqual([
    { score_pct: 80, total_questions: 20, correct_questions: 16 },
    { score_pct: 100, total_questions: 20, correct_questions: 20 },
  ]);
  await pupilPage.screenshot({ path: ".codex-artifacts/password-reset/password-change-complete.png", fullPage: true });
  const audit = await admin.from("student_account_audit").select("action,reason,outcome").eq("target_user_id", studentId);
  expect(audit.error).toBeNull();
  expect(audit.data).toHaveLength(1);
  expect(audit.data![0]).toMatchObject({ action: "reset_password", outcome: "success" });
  expect(JSON.stringify(audit.data)).not.toContain(temporary);
  await pupilPage.close();
});

test("rejects another teacher and serialises resets so a stale completion cannot clear a newer reset", async () => {
  const denied = await admin.rpc("begin_student_password_operation", { p_student: studentId, p_actor: otherTeacherId, p_operation: "issue", p_reset: null });
  expect(denied.error?.message).toContain("forbidden");
  const first = await admin.rpc("begin_student_password_operation", { p_student: studentId, p_actor: teacherId, p_operation: "issue", p_reset: null });
  expect(first.error).toBeNull();
  const overlap = await admin.rpc("begin_student_password_operation", { p_student: studentId, p_actor: teacherId, p_operation: "issue", p_reset: null });
  expect(overlap.error?.message).toContain("busy");
  expect((await admin.rpc("finish_student_password_operation", { p_student: studentId, p_operation_id: first.data.operation_id, p_success: false })).error).toBeNull();
  const newer = await admin.rpc("begin_student_password_operation", { p_student: studentId, p_actor: teacherId, p_operation: "issue", p_reset: null });
  expect(newer.error).toBeNull();
  const stale = await admin.rpc("finish_student_password_operation", { p_student: studentId, p_operation_id: first.data.operation_id, p_success: true });
  expect(stale.error?.message).toContain("changed");
  expect((await admin.rpc("finish_student_password_operation", { p_student: studentId, p_operation_id: newer.data.operation_id, p_success: false })).error).toBeNull();
});

test("an expired temporary password cannot unlock learning or finish a password change", async ({ page, browser }) => {
  await teacherLogin(page);
  const temporary = await reset(page);
  // Only the hardcoded local container can be targeted; no cloud SQL connection.
  execFileSync("/Applications/Docker.app/Contents/Resources/bin/docker", ["exec", "-i", "supabase_db_latin-quest-qa", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"], {
    input: `update latin_quest_private.student_password_resets set expires_at = now() - interval '1 minute' where student_id = '${studentId}';`, stdio: ["pipe", "pipe", "pipe"],
  });
  const pupil = await browser.newPage();
  await login(pupil, studentEmail, temporary);
  await expect(pupil).toHaveURL(/\/account\/change-password$/);
  await expect(pupil.getByRole("alert").filter({ hasText: "has expired" })).toBeVisible();
  await expect(pupil.getByRole("button", { name: "Save my new password" })).toHaveCount(0);
  const client = pupilClient();
  expect((await client.auth.signInWithPassword({ email: studentEmail, password: temporary })).error).toBeNull();
  expect((await client.rpc("student_password_status")).data).toMatchObject({ required: true, expired: true });
  expect((await client.from("class_members").select("class_id").eq("student_id", studentId)).data).toEqual([]);
  await pupil.close();
});

test("a pupil's existing authenticator remains required before and after replacing a temporary password", async ({ page, browser }) => {
  const email = `qa.password.mfa.${suffix}@hallifordschool.co.uk`;
  const { data: account, error: accountError } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: "Password QA MFA pupil" } });
  if (accountError || !account.user) throw accountError ?? new Error("Missing MFA dummy pupil");
  const id = account.user.id;
  const membership = await admin.from("class_members").insert({ class_id: classId, student_id: id });
  if (membership.error) throw membership.error;
  const pupil = await browser.newPage();
  await login(pupil, email, PASSWORD);
  await expect(pupil).toHaveURL(/\/learn$/);
  await pupil.goto("/account");
  await pupil.getByRole("button", { name: "Set up authenticator" }).click();
  await pupil.getByText("Can't scan the code?", { exact: true }).click();
  const pupilSecret = (await pupil.locator("details code").innerText()).trim();
  await pupil.getByRole("textbox", { name: "Authenticator code" }).fill(totp(pupilSecret));
  await pupil.getByRole("button", { name: "Verify and enable" }).click();
  await expect(pupil).toHaveURL(/\/learn$/);

  await teacherLogin(page);
  const temporary = await reset(page, email);
  await login(pupil, email, temporary);
  await expect(pupil).toHaveURL(/\/mfa\/verify$/);
  await pupil.goto("/account/change-password");
  await expect(pupil).toHaveURL(/\/mfa\/verify$/);
  await pupil.getByRole("textbox", { name: "Authenticator code" }).fill(totp(pupilSecret));
  await pupil.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(pupil).toHaveURL(/\/account\/change-password$/);
  await pupil.getByLabel("Temporary password from your teacher").fill(temporary);
  await pupil.getByLabel("Your new password", { exact: true }).fill(NEW_PASSWORD);
  await pupil.getByLabel("Confirm your new password").fill(NEW_PASSWORD);
  await pupil.getByRole("button", { name: "Save my new password" }).click();
  await expect(pupil).toHaveURL(/\/mfa\/verify$/);
  const aal1 = pupilClient();
  expect((await aal1.auth.signInWithPassword({ email, password: NEW_PASSWORD })).error).toBeNull();
  expect((await aal1.from("class_members").select("class_id").eq("student_id", id)).data).toEqual([]);
  await pupil.getByRole("textbox", { name: "Authenticator code" }).fill(totp(pupilSecret));
  await pupil.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(pupil).toHaveURL(/\/learn$/);
  await pupil.goto(EXERCISE);
  await expect(pupil.getByText("Question 1 of 20", { exact: true })).toBeVisible();
  await pupil.close();
});
