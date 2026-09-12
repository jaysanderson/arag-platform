import { expect, test } from "@playwright/test";

test("demo: create a note, watch the job, ask a grounded question", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("arag-shell .product")).toContainText("__PRODUCT_TITLE__");
  await page.click("#create");
  await expect(page.locator("#timeline .arag-steps li").first()).toBeVisible();
  await expect(page.locator("#notes tbody tr").first()).toContainText("Onboarding");
  await expect(page.locator("#notes tbody .arag-chip").first()).toContainText("PROCESSED", {
    timeout: 15_000,
  });
  await page.click("#ask");
  await expect(page.locator("#answer .arag-bubble.assistant").last()).toContainText("30 days", {
    timeout: 15_000,
  });
});

test("admin: sign in, see health, configuration, jobs and logs", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#login")).toBeVisible();
  await page.fill("#token", "e2e-admin-token");
  await page.click("#signin");
  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("arag-health")).toContainText("connected");
  await page.click('[data-tab="config"]');
  await expect(page.locator('[data-panel="config"] .arag-json')).toContainText("adminToken");
  await page.click('[data-tab="logs"]');
  await expect(page.locator("#log .line").first()).toBeVisible();
});
