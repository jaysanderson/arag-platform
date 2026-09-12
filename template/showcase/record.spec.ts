/** Playwright walkthrough that records the showcase (video + screenshots). Run: make showcase */
import { expect, test } from "@playwright/test";

const shot = (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: `showcase/out/${name}.png`, fullPage: true });
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("showcase walkthrough", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await pause(1500);
  await shot(page, "01-home");
  await page.click("#create");
  await expect(page.locator("#timeline .arag-steps li").first()).toBeVisible();
  await shot(page, "02-job-running");
  await expect(page.locator("#notes tbody .arag-chip").first()).toContainText("PROCESSED", {
    timeout: 20_000,
  });
  await pause(1000);
  await shot(page, "03-processed");
  await page.click("#ask");
  await expect(page.locator("#answer .arag-bubble.assistant").last()).not.toContainText("Thinking", {
    timeout: 20_000,
  });
  await pause(1500);
  await shot(page, "04-answer");
  await page.goto("/admin/");
  await page.fill("#token", "e2e-admin-token");
  await page.click("#signin");
  await expect(page.locator("arag-health")).toContainText("connected");
  await pause(1200);
  await shot(page, "05-admin-overview");
  await page.click('[data-tab="config"]');
  await pause(800);
  await shot(page, "06-admin-config");
  await page.click('[data-tab="logs"]');
  await pause(800);
  await shot(page, "07-admin-logs");
  await page.goto("/api/v1/docs");
  await pause(2500);
  await shot(page, "08-docs");
});
