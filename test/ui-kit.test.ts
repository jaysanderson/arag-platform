/**
 * Unit tests for the UI kit's behaviour (ui/arag-ui.js).
 *
 * The kit is a browser module, but every piece of *logic* in it — sorting, paging, filtering, nav
 * parsing, the branding hook, icon rendering, overlay placement — is a pure function, exported
 * precisely so it can be tested here rather than only through a browser. The DOM-bound half
 * (shell rendering, focus traps, the rail drawer) is covered by the template's Playwright specs at
 * 1440 and 390 px; `applyBranding` is exercised against a minimal element stub below, because it
 * is the documented extension point products build their own shells against.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeNavHref,
  applyBranding,
  type BrandingRoot,
  type BrandingTarget,
  brandingPlan,
  brandingVars,
  emptyState,
  errorState,
  esc,
  filterRows,
  fmtRelative,
  icon,
  iconNames,
  nextSort,
  paginate,
  parseNav,
  placeCard,
  type SortDirection,
  snippet,
  sortRows,
} from "../ui/arag-ui.js";

// ───────────────────────────── icons ─────────────────────────────

test("icon() renders one inline SVG per name on a single grid, and nothing for unknown names", () => {
  const svg = icon("search");
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 20 20"/);
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /fill="none"/);
  assert.match(svg, /aria-hidden="true"/, "decorative by default");
  assert.equal((svg.match(/<path /g) ?? []).length, 1, "one path per icon");
  assert.equal(icon("does-not-exist"), "", "unknown name renders nothing, not a mystery glyph");
  // Named icons are announced instead of hidden.
  const labelled = icon("search", { label: "Search documents" });
  assert.match(labelled, /role="img"/);
  assert.match(labelled, /aria-label="Search documents"/);
  assert.doesNotMatch(labelled, /aria-hidden/);
  // Stroke weight scales with size so the optical weight stays constant.
  const w = (s: number) => Number(/stroke-width="([\d.]+)"/.exec(icon("search", { size: s }))![1]);
  assert.ok(w(14) > w(20) && w(20) > w(32), "heavier stroke at small sizes");
  assert.ok(iconNames.length >= 24, "a usable core set");
  for (const n of iconNames) assert.notEqual(icon(n), "", n);
});

test("icon() escapes an attacker-controlled label", () => {
  const svg = icon("search", { label: '"><script>x</script>' });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&quot;&gt;&lt;script&gt;/);
});

// ───────────────────────────── table logic ─────────────────────────────

const rows = [
  { id: "a", name: "Beta", size: 30, owner: "kim" },
  { id: "b", name: "alpha", size: 200, owner: "" },
  { id: "c", name: "Gamma", size: 4, owner: "lee" },
  { id: "d", name: "alpha", size: 4, owner: null },
];

test("sortRows is stable, case-insensitive, numeric-aware and puts empty cells last", () => {
  assert.deepEqual(
    sortRows(rows, { key: "name" }).map((r) => r.id),
    ["b", "d", "a", "c"],
    "alpha, alpha, Beta, Gamma — case-insensitive, and the tie keeps source order",
  );
  assert.deepEqual(
    sortRows(rows, { key: "name", dir: "descending" }).map((r) => r.id),
    ["c", "a", "b", "d"],
    "reversing the comparison must not reverse the tie-break",
  );
  assert.deepEqual(
    sortRows(rows, { key: "size" }).map((r) => r.size),
    [4, 4, 30, 200],
    "numbers sort numerically, not as strings",
  );
  // Empty and null owners sort last in BOTH directions — a missing value is not "smallest".
  for (const dir of ["ascending", "descending"] as SortDirection[]) {
    const ids = sortRows(rows, { key: "owner", dir }).map((r) => r.id);
    assert.deepEqual(ids.slice(2).sort(), ["b", "d"], `empties last when ${dir}`);
  }
  assert.deepEqual(
    sortRows(rows, { dir: "none" }).map((r) => r.id),
    ["a", "b", "c", "d"],
    'dir "none" restores the source order',
  );
  // A custom accessor covers computed columns.
  assert.deepEqual(
    sortRows(rows, { get: (r: { size: number }) => -r.size }).map((r) => r.size),
    [200, 30, 4, 4],
  );
  assert.notEqual(sortRows(rows, { key: "name" }), rows, "never mutates the input");
  assert.deepEqual(sortRows(undefined, { key: "name" }), []);
});

test("nextSort cycles ascending → descending → unsorted, and restarts on a new column", () => {
  assert.deepEqual(nextSort(null, "name"), { key: "name", dir: "ascending" });
  assert.deepEqual(nextSort({ key: "name", dir: "ascending" }, "name"), {
    key: "name",
    dir: "descending",
  });
  assert.deepEqual(nextSort({ key: "name", dir: "descending" }, "name"), {
    key: null,
    dir: "none",
  });
  assert.deepEqual(nextSort({ key: "name", dir: "descending" }, "size"), {
    key: "size",
    dir: "ascending",
  });
});

test("paginate clamps, counts from 1 and reports an empty page honestly", () => {
  assert.deepEqual(paginate(53, 1, 25), {
    page: 1,
    pages: 3,
    pageSize: 25,
    total: 53,
    offset: 0,
    from: 1,
    to: 25,
    hasPrev: false,
    hasNext: true,
  });
  const last = paginate(53, 3, 25);
  assert.deepEqual([last.from, last.to], [51, 53], "the short last page stops at the total");
  assert.equal((paginate(53, 99, 25) as { page: number }).page, 3, "clamped up");
  assert.equal((paginate(53, 0, 25) as { page: number }).page, 1, "clamped down");
  const none = paginate(0, 1, 25);
  assert.deepEqual([none.from, none.to, none.pages, none.hasNext], [0, 0, 1, false]);
  assert.equal((paginate(10, 1, 0) as { pageSize: number }).pageSize, 1);
});

test("filterRows matches every term across the chosen fields, ignoring case", () => {
  const f = (q: string, fields?: string[]) => filterRows(rows, q, fields).map((r) => r.id);
  assert.deepEqual(f(""), ["a", "b", "c", "d"], "an empty query filters nothing");
  assert.deepEqual(f("  "), ["a", "b", "c", "d"]);
  assert.deepEqual(f("ALPHA"), ["b", "d"]);
  assert.deepEqual(f("alpha 4", ["name", "size"]), ["d"], "all terms must match, in any field");
  assert.deepEqual(f("kim", ["name"]), [], "fields restrict the haystack");
  assert.deepEqual(f("nothing-here"), []);
});

// ───────────────────────────── shell navigation ─────────────────────────────

test("parseNav reads labels, hrefs, icons and group headings", () => {
  assert.deepEqual(parseNav("--Workspace,Documents=/documents=document,Ask=/ask"), [
    { kind: "group", label: "Workspace" },
    { kind: "link", label: "Documents", href: "/documents", icon: "document" },
    { kind: "link", label: "Ask", href: "/ask", icon: "" },
  ]);
  assert.deepEqual(parseNav(""), []);
  assert.deepEqual(parseNav(undefined), []);
  assert.deepEqual(parseNav(" Docs = /docs , , =/x "), [
    { kind: "link", label: "Docs", href: "/docs", icon: "" },
  ]);
});

test("activeNavHref marks the current page by longest prefix, not by accident", () => {
  const nav = parseNav("Overview=/,Documents=/documents,Settings=/settings");
  assert.equal(activeNavHref(nav, "/"), "/");
  assert.equal(activeNavHref(nav, "/documents"), "/documents");
  assert.equal(activeNavHref(nav, "/documents/"), "/documents");
  assert.equal(activeNavHref(nav, "/documents/abc-123"), "/documents", "a detail page");
  assert.equal(activeNavHref(nav, "/documentsomething"), null, "a sibling path must not light up Documents");
  assert.equal(activeNavHref(nav, "/nowhere"), null);
});

test("placeCard keeps a floating card inside the viewport and flips above when needed", () => {
  const vp = { width: 1000, height: 800 };
  const card = { width: 330, height: 200 };
  const below = placeCard({ top: 100, bottom: 140, left: 40 }, card, vp);
  assert.deepEqual([below.top, below.left, below.placement], [150, 40, "below"]);
  // No room underneath: flip above the target.
  const above = placeCard({ top: 700, bottom: 740, left: 40 }, card, vp);
  assert.deepEqual([above.top, above.placement], [490, "above"]);
  // A target near the right edge pulls the card back in rather than overflowing.
  const clamped = placeCard({ top: 10, bottom: 40, left: 980 }, card, vp);
  assert.equal(clamped.left, 660);
  // Page scroll is added once, at the end.
  const scrolled = placeCard({ top: 100, bottom: 140, left: 40 }, card, vp, { scrollY: 500, scrollX: 20 });
  assert.deepEqual([scrolled.top, scrolled.left], [650, 60]);
});

// ───────────────────────────── branding hook ─────────────────────────────

test("brandingVars moves only the action and accent ramps", () => {
  assert.deepEqual(brandingVars({ primaryColor: "#ff0000", accentColor: "#00ff00" }), {
    "--arag-brand-500": "#ff0000",
    "--arag-brand-600": "#ff0000",
    "--arag-brand-700": "#ff0000",
    "--arag-accent-400": "#00ff00",
    "--arag-accent-500": "#00ff00",
  });
  assert.deepEqual(brandingVars({}), {}, "surfaces, text and status colours never move");
  assert.deepEqual(brandingVars(null), {});
});

test("brandingPlan is the documented data-attribute contract", () => {
  const plan = brandingPlan({
    productName: "Acme Docs",
    tagline: "Contract intelligence",
    logoUrl: "/branding/acme.svg",
    footerText: "© Acme",
    docsUrl: "/help",
    poweredBy: true,
  });
  const by = (sel: string) => plan.find((o) => o.sel === sel)!;
  assert.equal(by("[data-brand-name]").text, "Acme Docs");
  assert.deepEqual(by("[data-brand-tagline]"), {
    sel: "[data-brand-tagline]",
    text: "Contract intelligence",
    hidden: false,
  });
  assert.deepEqual(by("[data-brand-logo]").attr, { src: "/branding/acme.svg", alt: "Acme Docs" });
  assert.equal(by("[data-docs-link]").attr !== undefined, true);
  assert.equal(by("[data-powered-by]").hidden, false);
  assert.deepEqual(brandingPlan(null), []);

  // An empty payload hides the optional slots instead of leaving a torn image or a stale tagline.
  const empty = brandingPlan({ poweredBy: false });
  const e = (sel: string) => empty.find((o) => o.sel === sel)!;
  assert.equal(e("[data-brand-tagline]").hidden, true);
  assert.equal(e("[data-brand-logo]").hidden, true);
  assert.deepEqual(e("[data-brand-logo]").removeAttr, ["src"]);
  assert.equal(e("[data-powered-by]").hidden, true);
  assert.equal(e("[data-powered-by-credit]").hidden, true);
  assert.equal(e("[data-brand-name]").text, undefined, "no name ⇒ leave the markup's own name");
});

/** The smallest element/root stub applyBranding needs — it only ever touches these five members. */
function stubRoot(
  elements: Record<string, BrandingTarget[]>,
): BrandingRoot & { vars: Record<string, string> } {
  const style: Record<string, string> = {};
  return {
    documentElement: {
      style: {
        setProperty(k: string, v: string) {
          style[k] = v;
        },
        removeProperty(k: string) {
          delete style[k];
        },
      },
    },
    querySelectorAll: (sel: string) => elements[sel] ?? [],
    vars: style,
  };
}

test("applyBranding drives data-brand-* hooks on ANY element, not only <arag-shell>", () => {
  // This is the 0.1.x bug: a product with its own shell had to re-implement all of this.
  const name = { textContent: "Template" };
  const tagline = { textContent: "", hidden: true };
  const attrs: Record<string, string> = {};
  const removed: string[] = [];
  const logo = {
    hidden: true,
    setAttribute(k: string, v: string) {
      attrs[k] = v;
    },
    removeAttribute: (k: string) => removed.push(k),
  };
  const band = { hidden: false };
  const root = stubRoot({
    "[data-brand-name]": [name],
    "[data-brand-tagline]": [tagline],
    "[data-brand-logo]": [logo],
    "[data-powered-by]": [band],
  });

  applyBranding(
    {
      productName: "Acme Docs",
      tagline: "Contract intelligence",
      logoUrl: "/branding/acme.svg",
      primaryColor: "#7a29ff",
      poweredBy: true,
    },
    root,
  );
  assert.equal(name.textContent, "Acme Docs");
  assert.equal(tagline.textContent, "Contract intelligence");
  assert.equal(tagline.hidden, false);
  assert.deepEqual(attrs, { src: "/branding/acme.svg", alt: "Acme Docs" });
  assert.equal(logo.hidden, false);
  assert.equal(band.hidden, false);
  assert.equal(root.vars["--arag-brand-600"], "#7a29ff");

  // Switching the Progress signature off removes the band and collapses the space it occupied.
  applyBranding({ productName: "Acme Docs", poweredBy: false }, root);
  assert.equal(band.hidden, true);
  assert.equal(tagline.hidden, true, "a payload without a tagline clears the old one");
  assert.equal(logo.hidden, true);
  assert.deepEqual(removed, ["src"], "no torn image left behind");
  assert.equal(root.vars["--arag-band-h"], "0px");

  // Turning the signature back on restores the band's height rather than leaving the layout
  // collapsed around a hidden element.
  applyBranding({ productName: "Acme Docs", poweredBy: true }, root);
  assert.equal(band.hidden, false);
  assert.equal(root.vars["--arag-band-h"], undefined);
});

test("applyBranding is a no-op without a payload or a root", () => {
  const root = stubRoot({});
  applyBranding(null, root);
  applyBranding({ productName: "x" }, null);
  assert.deepEqual(root.vars, {});
});

// ───────────────────────────── render helpers ─────────────────────────────

test("render helpers escape their inputs", () => {
  assert.equal(esc('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  const empty = emptyState({ title: "<b>No documents</b>", body: "Add one & see" });
  assert.match(empty, /&lt;b&gt;No documents&lt;\/b&gt;/);
  assert.match(empty, /Add one &amp; see/);
  assert.match(empty, /class="arag-emptystate"/);
  assert.match(snippet("curl -H 'X: <y>'"), /&lt;y&gt;/);
  assert.match(snippet("x"), /class="copy"/);
  // errorState surfaces the problem detail and hides the machine code behind a disclosure.
  const err = errorState({
    status: 503,
    message: "boom",
    problem: { detail: "Knowledge Box unreachable", requestId: "req-1" },
  });
  assert.match(err, /role="alert"/);
  assert.match(err, /Knowledge Box unreachable/);
  assert.match(err, /<details/);
  assert.match(err, /HTTP 503/);
  assert.match(errorState({}), /did not respond/);
});

test("fmtRelative degrades to a date and never throws on rubbish", () => {
  const now = Date.parse("2026-09-12T12:00:00Z");
  assert.equal(fmtRelative("2026-09-12T11:59:50Z", now), "just now");
  assert.equal(fmtRelative("2026-09-12T11:58:00Z", now), "2 minutes ago");
  assert.equal(fmtRelative("2026-09-12T11:00:00Z", now), "1 hour ago");
  assert.equal(fmtRelative("2026-09-01T12:00:00Z", now), "11 days ago");
  assert.equal(fmtRelative("2026-01-01T12:00:00Z", now), "2026-01-01");
  assert.equal(fmtRelative("not a date", now), "—");
  assert.equal(fmtRelative(null, now), "—");
});
