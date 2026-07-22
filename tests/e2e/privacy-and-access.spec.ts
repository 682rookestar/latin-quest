import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("publishes adult and child-friendly privacy information", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await page.getByRole("link", { name: /privacy guide for students/i }).click();
  await expect(page.getByRole("heading", { name: /your privacy on latin quest/i })).toBeVisible();
});

test("redirects unauthenticated users away from pupil and teacher records", async ({ page }) => {
  for (const path of ["/learn", "/teacher", "/teacher/classes/test-class"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("sets baseline browser security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("privacy pages have no automatically detectable serious accessibility violations", async ({ page }) => {
  await page.goto("/privacy/children");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(serious).toEqual([]);
});
