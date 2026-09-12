import { expect, test } from "@playwright/test";

test("workspace: create a note, watch it process, open it, ask it a question", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("arag-app-shell .ident .name")).toContainText("__PRODUCT_TITLE__");

  // Create through the drawer — the one creation path in the product.
  await page
    .getByRole("button", { name: /Create a note|New note/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "New note" })).toBeVisible();
  await page.fill("#nTitle", "Onboarding policy");
  await page.click("#nCreate");

  // Creating navigates to the record, whose Processing tab streams the job.
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
  await expect(page.locator(".arag-pagehead h1")).toContainText("Onboarding policy");
  await page.getByRole("tab", { name: "Processing" }).click();
  await expect(page.locator("arag-job-timeline .arag-steps li").first()).toBeVisible();

  // Ask, scoped to this note.
  await page.getByRole("tab", { name: "Ask this note" }).click();
  await page.click("#ask");
  await expect(page.locator("#answers .arag-bubble.assistant").last()).toContainText("30 days", {
    timeout: 20_000,
  });
});

test("notes list: search, sort, select and bulk delete behind a typed confirm", async ({ page }) => {
  // Seeded here rather than relying on another spec: the dev server is reused between runs, so a
  // test that assumes what is already in the store is a test that fails on the second run.
  const marker = `Zeta-${Date.now()}`;
  await page.request.post("/api/v1/notes", { data: { title: marker, body: "Seeded for the list view." } });
  await page.goto("/notes");
  await expect(page.locator(".arag-datatable tbody tr").first()).toBeVisible({ timeout: 20_000 });

  // Search narrows the list and the count follows it.
  await page.fill("#q", marker);
  await page.locator("#q").press("Enter");
  await expect(page.locator(".arag-filterbar .count")).toContainText("of 1");
  await expect(page).toHaveURL(new RegExp(`q=${marker}`));
  await expect(page.locator(".arag-datatable tbody tr")).toHaveCount(1);

  // Sorting is announced through aria-sort, not just a coloured arrow.
  await page.locator('th[data-sort="title"] button').click();
  await expect(page.locator('th[data-sort="title"]')).toHaveAttribute("aria-sort", "ascending");

  // Selecting a row raises the bulk bar; deleting asks first and the dialog opens on Cancel.
  await page.locator("[data-check]").first().check();
  await expect(page.locator("[data-bulkbar]")).toBeVisible();
  await expect(page.locator("[data-bulk-count]")).toContainText("1 selected");
  await page.click("#bulkDelete");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // Row-actions menu: named per row, arrow-navigable, Escape closes it and returns focus.
  const trigger = page.locator(".rowactions .arag-menu > .trigger").first();
  await expect(trigger).toHaveAttribute("aria-label", /^Actions for /);
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("deep links and unknown paths are handled by the SPA fallback", async ({ page }) => {
  const res = await page.goto("/settings");
  expect(res?.status()).toBe(200);
  await expect(page.locator(".arag-pagehead h1")).toContainText("Settings");
  // The light-surface wordmark ships with the kit and is actually served, not just documented.
  const mark = page.locator('img[src="/ui/brand/arag-logo.svg"]');
  await expect(mark).toBeVisible();
  expect((await page.request.get("/ui/brand/arag-logo.svg")).status()).toBe(200);
  await page.goto("/nowhere-at-all");
  await expect(page.locator(".arag-emptystate")).toContainText("Page not found");
});

test("admin: sign in, then see health, configuration, jobs and logs in the same shell", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator(".arag-signin")).toBeVisible();
  await page.fill("#token", "e2e-admin-token");
  await page.click("#signin");
  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("arag-health")).toContainText("connected");
  await page.click('.arag-railnav a[href="#config"]');
  await expect(page.locator('[data-panel="config"] .arag-json')).toContainText("adminToken");
  await expect(page.locator('.arag-railnav a[href="#config"]')).toHaveAttribute("aria-current", "page");
  await page.click('.arag-railnav a[href="#jobs"]');
  await expect(page.locator("#jobsTable tbody tr").first()).toBeVisible();
  // The jobs table re-renders in place on every reload, so wireTable() is called again on the same
  // root. One click on a header must advance the sort by exactly one step — two sets of listeners
  // would run the cycle twice and land on "descending".
  await page.locator('#jobsTable th[data-sort="kind"] button').click();
  await expect(page.locator('#jobsTable th[data-sort="kind"]')).toHaveAttribute("aria-sort", "ascending");
  await page.click("#reloadJobs");
  await page.locator('#jobsTable th[data-sort="kind"] button').click();
  await expect(page.locator('#jobsTable th[data-sort="kind"]')).toHaveAttribute("aria-sort", "descending");
  await page.locator("#jobsTable tbody tr").first().click();
  await expect(page.locator("#jobDetail")).toContainText("process");
  await page.click('.arag-railnav a[href="#logs"]');
  await expect(page.locator("#log .line").first()).toBeVisible();
});
