import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const EMAIL = "qa.pupil1@hallifordschool.co.uk";
const PASSWORD = "Local-QA-Only!7294";
const EXERCISE_URL = "/learn/chapter/10000000-0000-4000-8000-000000000001/exercise/40000000-0000-4000-8000-000000000001";
const CLASS_ID = "30000000-0000-4000-8000-000000000001";

test.setTimeout(60_000);

function localAdmin(): SupabaseClient {
  const status = JSON.parse(execFileSync("npx", ["--yes", "supabase@2.117.0", "status", "--workdir", "tests/local", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }));
  if (status.API_URL !== "http://127.0.0.1:55321") throw new Error("Refusing non-local QA backend");
  return createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(EMAIL);
  await page.getByPlaceholder("password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/learn/);
}

async function openAnsweredExercise(page: Page) {
  await page.goto(EXERCISE_URL);
  await expect(page.getByText("Question 1 of 20")).toBeVisible();
  await page.getByRole("button", { name: "girl" }).click();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("checks answers concurrently while two exercise tabs remain active", async ({ context, page }) => {
  await openAnsweredExercise(page);
  const second = await context.newPage();
  await openAnsweredExercise(second);

  await Promise.all([
    page.getByRole("button", { name: "Check" }).click(),
    second.getByRole("button", { name: "Check" }).click(),
  ]);

  await expect(page.getByText("Correct")).toBeVisible();
  await expect(second.getByText("Correct")).toBeVisible();
  await expect(page.getByText(/session has expired/i)).toHaveCount(0);
  await expect(second.getByText(/session has expired/i)).toHaveCount(0);
});

test("keeps the selected answer when the answer-check request is interrupted", async ({ page }) => {
  await openAnsweredExercise(page);
  let interrupted = false;
  await page.route("**/*", async route => {
    if (!interrupted && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      interrupted = true;
      await route.abort("internetdisconnected");
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn’t check your answer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "girl" })).toHaveClass(/bg-sky\/15/);

  await page.unroute("**/*");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Correct")).toBeVisible();
});

test("shows the expired-session recovery link after a genuine sign-out", async ({ context, page }) => {
  await openAnsweredExercise(page);
  const accountTab = await context.newPage();
  await accountTab.goto("/account");
  await accountTab.getByRole("button", { name: "Sign out" }).click();
  await expect(accountTab).toHaveURL("http://127.0.0.1:3100/");

  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("link", { name: "Your session has expired — sign in again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "girl" })).toHaveClass(/bg-sky\/15/);
});

test("distinguishes removal from a class from an expired login", async ({ page }) => {
  await openAnsweredExercise(page);
  const admin = localAdmin();
  const { data: users, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) throw usersError;
  const pupil = users.users.find(user => user.email === EMAIL);
  if (!pupil) throw new Error("Synthetic QA pupil not found");

  const removed = await admin.from("class_members").delete().eq("class_id", CLASS_ID).eq("student_id", pupil.id);
  if (removed.error) throw removed.error;
  try {
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "class access could not be confirmed" })).toBeVisible();
    await expect(page.getByText(/session has expired/i)).toHaveCount(0);
  } finally {
    const restored = await admin.from("class_members").upsert({ class_id: CLASS_ID, student_id: pupil.id });
    if (restored.error) throw restored.error;
  }
});
