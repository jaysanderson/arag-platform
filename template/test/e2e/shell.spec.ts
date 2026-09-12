/**
 * The app shell at the two viewports the kit commits to: a 1440 px desktop and a 390 px phone.
 *
 * These are the assertions the three product passes each had to make locally before the shell
 * lived in the kit — the rail is a rail at 1440 and a drawer at 390, the Progress wordmark appears
 * exactly once, the identity block carries the product rather than repeating the wordmark, and
 * nothing scrolls sideways on a phone.
 */
import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

test.describe("app shell at 1440px", () => {
  test.use({ viewport: DESKTOP });

  test("rail is visible, collapses, and the band carries the wordmark once", async ({ page }) => {
    await page.goto("/");
    const rail = page.locator(".arag-rail");
    await expect(rail).toBeVisible();
    await expect(page.locator(".arag-rail-menu")).toBeHidden();

    // The Progress wordmark lives in the band, once. The rail's identity block is the PRODUCT.
    const wordmarks = page.locator('img[src*="arag-logo"]');
    await expect(wordmarks).toHaveCount(1);
    await expect(page.locator(".arag-appband .wordmark img")).toBeVisible();
    await expect(page.locator(".arag-rail .ident .name")).toContainText("__PRODUCT_TITLE__");
    await expect(page.locator(".arag-rail .ident .name")).not.toContainText("Progress Agentic RAG");

    // Green appears only as the band's rule, never as text.
    await expect(page.locator(".arag-appband")).toHaveCSS("border-bottom-color", "rgb(92, 229, 0)");

    // Current page is marked with aria-current, not merely a colour.
    await expect(page.locator('.arag-railnav a[href="/"]')).toHaveAttribute("aria-current", "page");
    await page.click('.arag-railnav a[href="/notes"]');
    await expect(page.locator('.arag-railnav a[href="/notes"]')).toHaveAttribute("aria-current", "page");

    // Collapsing keeps the accessible name and survives a reload.
    // Polled, because the column width is animated.
    const railWidth = async () => (await page.locator(".arag-rail").boundingBox())!.width;
    await expect.poll(railWidth).toBeGreaterThan(200);
    await page.click(".arag-rail-toggle");
    await expect(page.locator(".arag-app")).toHaveAttribute("data-rail", "collapsed");
    await expect.poll(railWidth).toBeLessThan(100);
    await expect(page.locator('.arag-railnav a[href="/notes"]')).toHaveAttribute("title", "Notes");
    await page.reload();
    await expect(page.locator(".arag-app")).toHaveAttribute("data-rail", "collapsed");
    await page.click(".arag-rail-toggle");
    await expect.poll(railWidth).toBeGreaterThan(200);
  });

  test("anchor-buttons render as buttons, not as links", async ({ page }) => {
    // The 0.1.x specificity bug: `.arag a` (0,1,1) beat `.arag-btn` (0,1,0), so a primary
    // anchor-button was brand-blue text on a brand-blue fill, and a ghost one was blue too.
    await page.goto("/settings");
    const primary = page.locator('a.arag-btn[href="/admin/"]');
    await expect(primary).toBeVisible();
    await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(primary).toHaveCSS("text-decoration-line", "none");
    await primary.hover();
    await expect(primary).toHaveCSS("text-decoration-line", "none");

    await page.goto("/");
    const ghost = page.locator("a.arag-btn.ghost").first();
    await expect(ghost).toBeVisible();
    // Muted, i.e. the ghost variant won — not rgb(43, 43, 178), the base link colour.
    await expect(ghost).toHaveCSS("color", "rgb(85, 98, 122)");
  });

  test("anchor tabs are styled and keyboard-navigable", async ({ page }) => {
    // Own fixture, so this test does not depend on what the journey specs left behind.
    const made = await page.request.post("/api/v1/notes", {
      data: { title: "Tab fixture", body: "Expense claims must be filed within 30 days." },
    });
    const { note } = (await made.json()) as { note: { id: string } };
    await page.goto(`/notes/${note.id}`);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    // The selected tab is underlined by the component, not by the base link rule.
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveCSS("border-bottom-color", "rgb(43, 43, 178)");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
  });
});

test.describe("app shell at 390px", () => {
  test.use({ viewport: PHONE });

  test("rail becomes a drawer, and nothing scrolls sideways", async ({ page }) => {
    await page.request.post("/api/v1/notes", {
      data: { title: "Phone fixture", body: "A note so every screen has content to overflow." },
    });
    await page.goto("/");
    const menu = page.locator(".arag-rail-menu");
    await expect(menu).toBeVisible();
    await expect(page.locator(".arag-rail-toggle")).toBeHidden();
    // Off-canvas: present in the tree (so its links stay in the DOM) but not on screen.
    const railX = async () => (await page.locator(".arag-rail").boundingBox())!.x;
    expect(await railX()).toBeLessThan(0);

    await menu.click();
    await expect(page.locator(".arag-app")).toHaveAttribute("data-rail", "open");
    await expect.poll(railX).toBeGreaterThanOrEqual(0); // polled: it slides in over 180ms
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".arag-scrim")).toBeVisible();

    // Escape closes it, as does the scrim.
    await page.keyboard.press("Escape");
    await expect(page.locator(".arag-app")).not.toHaveAttribute("data-rail", "open");
    await expect.poll(railX).toBeLessThan(0);
    await menu.click();
    await page.locator(".arag-scrim").click({ position: { x: 350, y: 400 } });
    await expect(page.locator(".arag-app")).not.toHaveAttribute("data-rail", "open");

    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.goto("/notes");
    await expect(page.locator(".arag-filterbar")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.goto("/settings");
    expect(await overflow()).toBeLessThanOrEqual(1);
  });

  test("the wide notes table scrolls inside its own box, not the page", async ({ page }) => {
    await page.request.post("/api/v1/notes", {
      data: { title: "Phone fixture", body: "A note so the list has a table to measure." },
    });
    await page.goto("/notes");
    const table = page.locator(".arag-datatable .scroll");
    await expect(table).toBeVisible();
    const scrollable = await table.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrollable).toBe(true);
  });
});
