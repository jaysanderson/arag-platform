# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [0.1.0] - 2026-09-12
### Added
- `AragClient`: typed REST client (upload, resources, file fields with Range download, find, catalog, ask NDJSON streaming with `answer_json_schema`, search configurations, labelsets, data-augmentation tasks, REMi, configuration/schema, health) with timeouts, aborts, retry helper and injectable fetch.
- Mock ARAG server with deterministic fixtures for documents and call transcripts, DA task simulation, citations, Range downloads.
- HTTP toolkit: `App` router, `Ctx`, middleware (security headers, CORS), auth (admin token, API keys, signed sessions), token-bucket rate limiting, OpenAPI-driven validation, RFC 9457 problems, SSE, streaming, multipart, static serving, Redoc/Swagger docs pages.
- Config loader (`.env`, typed env, redaction), JSON-line logger with ring buffer.
- JSON Schema subset validator, OpenAPI 3.1 builders and contract-test helpers.
- `Store`/`Collection` (atomic JSON persistence) and `JobManager` (stages, events, cancellation, SSE fan-out).
- UI kit (`ui/arag-ui.css`, `ui/arag-ui.js`), product repo template, `sync-platform` and `new-product` scripts, `STANDARDS.md`.

## [0.1.1] - 2026-09-12
### Fixed
- `App.close()` is idempotent and no longer rejects when the server was already closed; template `close()` always shuts the mock ARAG down (fixes a hanging test process in scaffolded products).

## [0.1.2] - 2026-09-12
### Security
- Rate limiter / `ctx.ip` no longer trusts client-supplied `X-Forwarded-For`; `TRUST_PROXY=fly|xff|none` (default `fly`) selects the trusted header.
- `constantTimeEqual()` exported; template admin login uses it.
- Default CSP narrowed (no product-specific hosts, `object-src 'none'`); `securityHeaders({ connectSrc, scriptSrc, … })` lets products extend it.
- Static serving resolves symlinks before the containment check.
- Admin config redaction shows only secret length.
### Fixed
- Job events emitted after finish/cancel are dropped.
- JSON stores flush on process exit/SIGINT/SIGTERM.
- Mock `/ask` quotes the best-matching sentences; template admin reloads widgets after sign-in; Playwright runs with `PW_DISABLE_TS_ESM=1` (Node 26 ESM loader hang).

## [0.1.3] - 2026-09-12
### Fixed
- Export `constantTimeEqual`; template lint clean; `make smoke` live check against a sandbox KB.

## [0.1.4] - 2026-09-12
### Added
- Per-route rate limits (`rateLimit: { rps, burst }` route option, separate bucket per client and route).
- Mock fixtures re-exported (`SAMPLE_DOCS`, `SAMPLE_CALL_TRANSCRIPT`, `mockFixtures`).
- `Collection.corruptBackup` plus an error log line when a store file is quarantined.
### Changed
- UI kit: `[hidden] { display: none !important }` so grid/flex containers honour `hidden`.
- Deliberate 5xx `HttpError`s log at warn without a stack; only unexpected exceptions log stacks.
- Admin config redaction shows a length bucket (short/medium/long) instead of the exact length.
- Mock labeler assigns at most one paragraph label and two resource labels.
- `ENV_FILE=/dev/null` disables `.env` loading; template Playwright config uses a per-product port and no `.env`.

## [0.1.5] - 2026-09-12
### Fixed
- Multipart boundaries are case-sensitive: the parser now receives the original `Content-Type` (browser uploads with `----WebKitFormBoundary…` parsed to zero parts before).
- `parseMultipart` tolerates non-percent-encoded filenames (was a 500) and strips path separators.
### Docs
- Scope single-document asks with `resource_filters`; per-resource `/ask` fails with `full_resource` on the live platform.

## [0.1.6] - 2026-09-12
### Added
- White-label branding: `readBranding(env)` / `Branding` / `BrandingSchema` (BRAND_* variables), UI kit `applyBranding()` and `<arag-shell>` reading `GET /api/v1/branding` (name, logo, colours, powered-by toggle, footer, docs link); `ui/favicon.svg`.

## [0.1.7] - 2026-09-12
### Fixed
- `parseDotEnv` strips unquoted trailing comments (`KEY=value  # note`), so a copied `.env.example` boots; quoted values and leading `#` (colours) are preserved.

## [0.1.8] - 2026-09-12
### Security
- Branding colours use a strict grammar (hex, numeric `rgb()/hsl()`, keywords) so values are safe to interpolate into server-rendered styles; `isSafeColor()` exported.
### Docs
- Next.js products: `ENV_FILE=/dev/null` does not stop Next loading `.env` — blank `ARAG_*` explicitly in test servers (see template docs).

## [0.2.0] - 2026-09-12

The three product-experience passes (D-28) each rebuilt the same generic application chrome
locally. This release lifts that chrome into the kit so the fourth partner product starts with it,
fixes the platform bugs the products had to work around, and ships the official wordmarks.

### Added
- **Left-rail application shell** — `<arag-app-shell>` (and `<arag-shell layout="rail">`, so an
  existing two-band product migrates by adding one attribute): ink brand band carrying the Progress
  wordmark once, a rail with an identity block (product name, tagline, partner mark) in either
  the dark (default) or `rail="light"` family, grouped
  navigation with `aria-current`, a foot with the connection pill, a collapsible icon rail
  (remembered in `localStorage`) and a scrim-backed drawer below 900 px. `setActivePath()` for
  pushState routers, `setNavBadge()` for counts, `#aragLive` as the screen's one polite live region.
- **Application components**: `.arag-pagehead`, `.arag-breadcrumb`, `.arag-filterbar` /
  `.arag-search` / `.arag-filterchip`, `.arag-datatable` (sticky header, `aria-sort` sorting,
  row selection, stale-refresh bar) with `.arag-bulkbar` and `.arag-pagination`, `.arag-drawer` /
  `.arag-inspector`, `.arag-confirm` (incl. type-to-confirm), `.arag-emptystate`, `.arag-statstrip`,
  `.arag-segmented`, `.arag-skeleton`, `.arag-snippet` (copy button), `.arag-timeline`,
  `.arag-split`, tour overlay, `.arag-signin`, `.arag-menu` / `.arag-popover`, `.arag-meter`,
  `.arag-pill-live`, `.arag-skip`.
- **Behaviours**: `openDrawer`, `confirmDialog`, `menuButton`, `popover`, `tour`, `wireTabs`,
  `wireSegmented`, `wireTable`, `wireCopy`, `announce`, `emptyState`, `errorState`, `skeletonRows`,
  `snippet` — all with the focus, keyboard and live-region behaviour the design docs asked for
  (focus trap + return, Escape, `role="alertdialog"` with focus on Cancel, arrow-key tablists and
  segmented controls, `indeterminate` select-all, polite selection counts).
- **Inline-SVG icon convention** and a 35-icon core set: `icon(name, { size, label, cls })`,
  `<arag-icon>`, `iconNames`. One 20×20 grid, `currentColor`, stroke width scaled with render size.
  No icon fonts, no sprites, no emoji.
- **Official wordmarks** in `ui/brand/` (`arag-logo.svg` for light surfaces, `arag-logo-alt.svg`
  for dark) plus `ui/brand/README.md` carrying the `#5ce500` usage rule all three products landed on
  independently. Both shells now use the artwork instead of a dot-and-text lockup, and the band
  wears the 2 px green rule. New tokens `--arag-green` / `--arag-green-ink`, plus shell metrics
  (`--arag-band-h`, `--arag-rail-w`, `--arag-rail-collapsed-w`, `--arag-drawer-w`,
  `--arag-inspector-w`, `--arag-content-max`, `--arag-gutter`, `--arag-row-h`).
- **Pure, unit-tested list-view logic**: `sortRows` (stable, case-insensitive, numeric-aware,
  empties last in both directions), `nextSort`, `paginate`, `filterRows`, `parseNav`,
  `activeNavHref`, `placeCard`, `brandingPlan`, `brandingVars`, `fmtRelative`.
- `App.static(prefix, dir, { fallback })` — **opt-in SPA fallback**. A GET under `prefix` that
  matches no file and looks like a navigation (no extension, `Accept: text/html`) is answered with
  the fallback document. Opt-in because a silently 200'd missing script is worse than a 404; the
  longest matching mount owns the path, so an asset mount without a fallback opts its subtree out.
- `ui/arag-ui.d.ts` — type declarations for the kit (the runtime stays plain browser JavaScript).
- `brand-base` shell attribute (default `/ui/brand`) for products that mount the kit's assets
  somewhere other than `/ui`.

### Fixed
- **`.arag a` out-specified `.arag-btn`** (0,1,1 vs 0,1,0), so `<a class="arag-btn">` rendered
  brand-blue text on a brand-blue fill. Base element rules — links, headings, paragraphs,
  `code`/`pre` — are now wrapped in `:where()` and weigh zero, so any component class wins. The same
  bug hid `.arag-snippet` behind `.arag pre`.
- **`.arag-tabs` styled `button` only**; `a[role="tab"]` is now styled identically, so a tab that is
  a real route keeps Enter, middle-click and Back.
- **`.arag-dropzone .icon` sized a font glyph**, which did nothing to an inline SVG; it now sizes
  the SVG box.
- **`applyBranding()` only walked `<arag-shell>`**, so a product with its own shell re-implemented
  it. It now drives documented `data-brand-*` attributes on **any** element under any root, and
  `brandingPlan()` exposes the operation list. Products should pass their name and tagline as
  `readBranding` defaults so the payload is authoritative.
- `wireTable()` is idempotent and fully delegated: calling it again on the same root (which an
  admin list does on every reload) swaps the callbacks instead of binding a second set of listeners
  — and because every handler is delegated from the root, sorting, selection and pagination keep
  working after a tbody re-render.
- `announce()` creates the polite live region when a product renders its own shell, instead of
  silently doing nothing.
- Verified `body: "auto"` does **not** lowercase the multipart `Content-Type` (fixed in 0.1.5 — the
  parser receives `rawCt`). Regression-locked with an explicit `body: "auto"` route and
  `----WebKitFormBoundary…` bodies under three media-type casings.

### Changed
- Template scaffolds a real workspace, not a one-page demo: the rail shell with Overview / Notes /
  Ask / Settings, a Documents-style notes list (server-side search, status filter, sort, selection,
  bulk delete behind a typed confirm, pagination), a record page with Overview / Processing / Ask
  tabs and a breadcrumb, a settings area (connection, branding, API access, danger zone), and the
  operator console in the same shell with a sign-in card and Overview / Configuration / Jobs / Logs.
  New API: `q` / `status` / `sort` on `GET /api/v1/notes`, `POST /api/v1/notes/bulk-delete`,
  `ref` on `GET /api/v1/jobs`. `app.static("/", …, { fallback: true })` gives it real URLs.
- Template notes list uses the kit's row-actions menu (Open / Delete) instead of a bare Open
  button, so `menuButton()` is exercised by the shipped e2e suite.
- Template Playwright config sets `RATE_LIMIT_RPS=0` for the e2e server — a workspace screen makes
  far more `/api/v1` calls than the old single page, and the default 5 rps bucket made the suite
  flaky.
- `scripts/new-product.sh` also substitutes `__PRODUCT_*` in `.js`, `.css` and `Dockerfile`.
- Template `README.md`, `showcase/SCRIPT.md`, `showcase/STORYBOARD.md` and the two business
  walkthroughs describe the workspace that now ships, instead of the one-page demo.

### Migration — what each product can delete after re-vendoring

Re-vendor with `make sync-platform TARGET=<repo>`, swap the local class for the kit class, then
delete the local CSS block. Nothing below changes behaviour; the kit's versions add the keyboard,
focus and live-region handling the design docs specified.

**arag-doc-processing** (`public/ui-ext.css`, `.dip-*` — 15 of 22 blocks go):
`.dip-skip` → `.arag-skip`; `.dip-app`/`.dip-app__body`/`.dip-sidebar`/`.dip-content` →
`.arag-app`/`.body`/`.arag-rail`/`.arag-content`; `.dip-brandmark` → `.arag-rail .ident`;
`.dip-sidenav` → `.arag-railnav`; `.dip-pagehead` → `.arag-pagehead`; `.dip-breadcrumb` →
`.arag-breadcrumb`; `.dip-tabs` → `.arag-tabs` (the kit now styles anchors); `.dip-filterbar`/
`.dip-search` → `.arag-filterbar`/`.arag-search`; `.dip-tablewrap`/`.dip-tablescroll`/
`.dip-datatable` → `.arag-datatable` + `.scroll`; `.dip-bulkbar` → `.arag-bulkbar`;
`.dip-pagination` → `.arag-pagination`; `.dip-drawer*` → `.arag-drawer`; `.dip-confirm` →
`.arag-confirm`; `.dip-emptystate` → `.arag-emptystate`; `.dip-statstrip` → `.arag-statstrip`;
`.dip-menu*` → `.arag-menu`; `.dip-skeleton` → `.arag-skeleton`; `.dip-tour__*` → the kit's
`tour()`; `.dip-signin` → `.arag-signin`; `.dip-popover` → `.arag-popover`; `.dip-split` →
`.arag-split`; `.dip-prose`/`.dip-chips` → `.arag-prose`/`.arag-chips`. `lib/core.js` can drop its
copies of `renderShell`, `applyShellBranding`, `openDrawer`, `confirmDialog`, `menuButton`,
`wireTabs`, `popover`, `trapFocus`, `closeOverlay`, `emptyState`, `errorState`, `skeletonRows`,
`announce`, `icon`/`PATHS`, `fmtRelative` and `fmtBytes`/`fmtMs` — import them from the kit.
**Stays local** (genuinely this product's): `.dip-field*`, `.dip-grounding*`, `.dip-source*`,
`.dip-quote`, `.dip-fieldrow`, `.dip-timeline`/`.dip-stagecell`, `.dip-uploadqueue`, `.dip-bar`,
`.dip-entity`, `.dip-preview`, `mark.dip-hit`, `.dip-swatch`, `.dip-suggestions`.

**arag-voice** (`public/ui-ext.css`, `.vb-*` — 14 of 28 blocks go): `.vb-app`/`.vb-rail`/`.vb-nav`/
`.vb-rail-foot`/`.vb-main`/`.vb-content` → the kit shell; `.vb-wordmark` + `.vb-product` →
`.arag-appband .wordmark` + `.arag-rail .ident`; `.vb-topbar`/`.vb-crumbs` → `.arag-breadcrumb`
(+ `.arag-pagehead`); `.vb-page-head` → `.arag-pagehead`; `.vb-filters`/`.vb-search` →
`.arag-filterbar`/`.arag-search`; `.vb-table-wrap`/`.vb-scroll`/`table.vb-table`/`.vb-pager` →
`.arag-datatable` + `.scroll` + `.arag-pagination`; `.vb-empty` → `.arag-emptystate`; `.vb-stats`/
`.vb-stat` → `.arag-statstrip`; `.vb-drawer*` → `.arag-drawer`; `.vb-segmented` → `.arag-segmented`;
`.vb-snippet`/`.vb-copy` → `.arag-snippet` + `wireCopy()`; `.vb-skeleton` → `.arag-skeleton`;
`.vb-timeline` → `.arag-timeline`; `.vb-split`/`.vb-grid` → `.arag-split`/`.arag-grid`;
`.vb-card` → `.arag-card`; `.vb-menu-btn` → `.arag-rail-menu`; `.vb-chip-live` → `.arag-pill-live`;
`.vb-icon` → `.arag-icon` (note: `.vb-icon` had no CSS rule at all, so the documented stroke rules
were unenforced — the kit's `icon()` enforces them). `app/icons.js` can be deleted in favour of the
kit's `icon()` plus a small product-specific map for `live`, `webhook`, `mic`, `keyboard`, `spark`,
`target`, `prospects`, `usage`. `--vb-accent` should become `--arag-green` and the readable
`--vb-accent-ink` should become `--arag-accent-fg` — VoiceBridge's use of bright green as a
*liveness* signal is fine on the dark rail and inside `.arag-pill-live`, but not as text on white.
**Stays local**: `.vb-live`, `.vb-brief*`, `.vb-transcript`, `.vb-starter`/`.vb-sources-picker`/
`.vb-source-option`, `.vb-scribe`, `.vb-powered`, `.vb-stale`, `.vb-live-dot`, `.vb-onboard`,
`.vb-sources`, `.vb-suggestion`.

**call-analysis** (`public/ui-ext.css` — 15 of 24 blocks go, and this file was already authored in
kit style, so most of it is a rename or a straight deletion): `.arag-app`/`.arag-appband`/
`.arag-sidebar`/`.arag-page`/`.arag-pagebody` → the kit's `.arag-app`/`.arag-appband`/`.arag-rail`/
`.arag-main`/`.arag-content` (note the kit's rail is **dark**, matching VoiceBridge and the band —
call-analysis's light sidebar is the one visual change); `.arag-pagehead`, `.arag-breadcrumb`,
`.arag-stat-strip` → `.arag-statstrip`, `.arag-filterbar`, `.arag-search`, `.arag-filterchip`,
`.arag-segmented`, `.arag-datatable`, `.arag-bulkbar`, `.arag-pagination`, `.arag-menu`,
`.arag-drawer` + `.arag-inspector`, `.arag-skel` → `.arag-skeleton`, `.arag-emptystate`,
`.arag-meter`, `.arag-pill-live` — **delete all of these local copies**, they are now the kit's.
The entire "kit compatibility fixes" block at the bottom of the file goes: the `.arag a` /
`.arag-tabs` / `.arag-dropzone` / `.arag-input[type=color]` / `.arag-stack` / busy-table
work-arounds are all fixed upstream. `--pg-green`/`--pg-green-ink` → `--arag-green`/
`--arag-green-ink`. **Stays local**: `.arag-moments` (rename to `.ca-moments`), `.arag-state`
(the kit's `.arag-chip` covers it — or keep it as `.ca-state` if the dot matters),
`.arag-stepper`, `.arag-light-reveal`, and the media/transcript components. **Next.js note:** the
shells now render `<img src="/ui/brand/arag-logo-alt.svg">`, so copy `vendor/arag-platform/ui/brand/`
into `public/ui/brand/` alongside `arag-ui.js`, or the band's wordmark 404s.

Proposals the kit deliberately did **not** take: `.arag-tip` (tooltip — a title attribute or
`.arag-popover` covers the cases we have), `.arag-confidence` (a trust surface, and trust surfaces
stay with the product that owns the semantics), `.dip-fieldrow`, `.vb-pipeline`.

### Design review (pre-release, against the three products' screenshots)
- Sign-in no longer shows the Progress wordmark twice: inside a shell the band carries it and the
  card's is hidden; `.arag-signin.standalone` is the bandless, full-bleed-ink form where the card
  carries the only wordmark (VoiceBridge's operator sign-in set the precedent).
- Collapsed rail hides the connection pill's *label*, not only its siblings — "Knowledge Box ·
  online" was wrapping to three lines in a 64 px column. The full text stays in the pill's `title`.
- `.arag-datatable > .scroll` paints a scroll-linked right-edge shade, so a clipped column reads as
  scrollable instead of as a truncation bug. (The page itself never scrolls sideways; the shell spec
  asserts that at 390 px.)
- `rail="light"` ships alongside the dark default: Document Processing and Call Analysis both used a
  light sidebar, VoiceBridge a dark one, and hard-coding one of the two would have silently dropped
  half the established pattern. Tokens only; on a light rail the current-item marker is the action
  colour, because green is never a marker on a light surface.
- Band links shrink and stop wrapping below 600 px ("API docs" was breaking in half at 390).

### QA review (pre-release)
- Escape inside a row-actions menu no longer closes the drawer the menu sits in: `menuButton()`
  stops the event instead of letting it bubble to the document-level "close the open overlay"
  handler.
- `wireTabs()` and `wireSegmented()` are idempotent and delegated, like `wireTable()` — calling
  either again on a persisted container swaps the callback rather than adding a second keyboard
  handler, and both re-read their options on each keypress so a re-render cannot strand them.
- `<arag-app-shell>` removes its `window`/`document` listeners in `disconnectedCallback()`, so a
  host that destroys and recreates the element does not leak one set per instance.
- `arag-logo.svg` (the light-surface wordmark) is now actually used rather than merely shipped: it
  is the powered-by credit in the two-band shell's footer (`.arag-footer .credit`, 14 px at 75%
  opacity, the treatment Call Analysis's design set) and the default mark shown on the template's
  Settings screen, where the e2e suite asserts it is served.
- `ui/brand/README.md` quoted one viewBox for both files; they differ slightly
  (`0 0 526.06 61` / `0 0 525.25 61`), which matters if you ever swap them inside a fixed-width box.

### Docs
- `docs/ui-kit.md` rewritten: tokens, shell, component table, the data-table markup contract, the
  overlay behaviour contract, the icon convention, the branding hook and the specificity rule.
- `STANDARDS.md` § 8b "Product-experience bar (front end)" — what the platform enforces, pointing
  at `PRODUCT-EXPERIENCE-BRIEF.md` for the bar itself. The E2E row of the testing bar now requires
  the shell check at 1440 and 390 px.
- `ui/brand/README.md` — wordmark files, sizing and the `#5ce500` rule.
- `docs/screenshots/kit-*.png` — the scaffolded product at 1440 and 390 px.
