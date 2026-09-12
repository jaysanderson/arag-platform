/** Playwright walkthrough that records the showcase (video + screenshots). Run: make showcase */
import { expect, test } from "@playwright/test";

const shot = (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: `showcase/out/${name}.png`, fullPage: true });
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("showcase walkthrough", async ({ page }) => {
  test.setTimeout(180_000);

  // 1 — the workspace, not a single page.
  await page.goto("/");
  await pause(1500);
  await shot(page, "01-overview");

  // 2 — create through the drawer.
  await page
    .getByRole("button", { name: /Create a note|New note/ })
    .first()
    .click();
  await pause(700);
  await shot(page, "02-new-note-drawer");
  await page.click("#nCreate");
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
  await pause(800);
  await shot(page, "03-note-record");

  // 3 — the job, streamed into the record's Processing tab.
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.locator("arag-job-timeline .arag-steps li").first()).toBeVisible();
  await pause(1200);
  await shot(page, "04-processing");

  // 4 — a grounded answer, scoped to the note.
  await page.getByRole("tab", { name: "Ask this note" }).click();
  await page.click("#ask");
  await expect(page.locator("#answers .arag-bubble.assistant").last()).not.toContainText("Thinking", {
    timeout: 20_000,
  });
  await pause(1500);
  await shot(page, "05-grounded-answer");

  // 5 — the list: search, sort, bulk selection.
  await page.goto("/notes");
  await expect(page.locator(".arag-datatable tbody tr").first()).toBeVisible({ timeout: 20_000 });
  await pause(600);
  await shot(page, "06-notes-list");
  await page.locator("[data-check]").first().check();
  await pause(500);
  await shot(page, "07-bulk-bar");

  // 6 — settings, then the operator console in the same shell.
  await page.goto("/settings");
  await pause(800);
  await shot(page, "08-settings");
  await page.goto("/admin/");
  await pause(500);
  await shot(page, "09-operator-signin");
  await page.fill("#token", "e2e-admin-token");
  await page.click("#signin");
  await expect(page.locator("arag-health")).toContainText("connected");
  await pause(1200);
  await shot(page, "10-admin-overview");
  await page.click('.arag-railnav a[href="#jobs"]');
  await pause(800);
  await shot(page, "11-admin-jobs");
  await page.click('.arag-railnav a[href="#logs"]');
  await pause(800);
  await shot(page, "12-admin-logs");

  // 7 — the API the whole product is built on.
  await page.goto("/api/v1/docs");
  await pause(2500);
  await shot(page, "13-api-docs");
});
