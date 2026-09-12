# UI kit

Two files, no build step: link them and go.

```html
<link rel="stylesheet" href="/ui/arag-ui.css" />
<script type="module" src="/ui/arag-ui.js"></script>
<body class="arag">…</body>
```

Serve them from a product with `app.static("/ui", "./vendor/arag-platform/ui")`. Next.js products
import the CSS globally and copy `arag-ui.js` and `brand/` into `public/ui/`. `ui/arag-ui.d.ts`
gives TypeScript callers completion; the runtime stays plain JavaScript.

As of **0.2.0** the kit carries the application components all three product teams had to build
locally in the product-experience pass (`.dip-*`, `.vb-*` and the call-analysis `.arag-*`
extensions). A fourth product starts with them. See CHANGELOG 0.2.0 for the per-product migration
map.

---

## Tokens

`:root` in `arag-ui.css`: the Progress ink blues (`--arag-ink-*`), the action ramp
(`--arag-brand-*`), the accent ramp (`--arag-accent-*`), status pairs (`--arag-warn-*`,
`--arag-danger-*`, `--arag-info-*`), surfaces, text, type, radius, shadow and focus ring.
Dark theme via `[data-theme="dark"]` or `.arag-dark`.

Shell metrics are tokens too, so a product can retune the shape without forking the CSS:
`--arag-band-h`, `--arag-rail-w`, `--arag-rail-collapsed-w`, `--arag-drawer-w`,
`--arag-inspector-w`, `--arag-content-max`, `--arag-gutter`, `--arag-row-h`.

### Progress green

`--arag-green` (`#5ce500`) and `--arag-green-ink` (`#00123c`) are **brand** values, not UI values.
Green is a fill and a dark-surface colour: it is 1.6:1 on white, so it is never text on a light
surface, never a hairline, and never the only signal for a state. The kit uses it in exactly three
places — inside the wordmark artwork, as the 2 px rule under `.arag-appband`, and as the fill of
`.arag-pill-live` / the rail's current-item marker. Anything that *means* success or "ready" uses
`--arag-accent-500` / `--arag-accent-fg`, which are contrast-tuned and swap in dark mode. Full rule
in [`ui/brand/README.md`](../ui/brand/README.md).

---

## Application shell

```html
<arag-app-shell
  product="Documents"
  tagline="Extraction you can verify"
  nav="--Workspace,Overview=/=home,Documents=/documents=document,--Configure,Settings=/settings=settings"
  admin-href="/admin/" docs-href="/api/v1/docs" status-endpoint="/readyz" collapsible>
  …page content…
</arag-app-shell>
```

Three regions: an ink **band** carrying the Progress wordmark (once), a dark left **rail**
(identity block → navigation → foot), and the main column. `<arag-shell layout="rail">` renders the
same thing, so an existing two-band product migrates by adding one attribute.

- `nav` entries are `Label=/href=icon`; `--Heading` starts a group. `parseNav()` is exported.
- The **identity block** is the product: `[data-brand-name]`, `[data-brand-tagline]` and
  `[data-brand-logo]` (the partner's mark, when `BRAND_LOGO_URL` is set). It never repeats the
  Progress wordmark, which lives in the band above it.
- `rail="light"` switches the rail to the light family (Document Processing and Call Analysis used
  it; VoiceBridge used the dark default). Only tokens and two hard-coded whites move — structure,
  spacing and behaviour are identical, and the current-item marker becomes the action colour,
  because green is never a marker on a light surface.
- `collapsible` adds the rail toggle (≥ 900 px; remembered in `localStorage`). Collapsed, labels
  are visually hidden but keep their accessible names, each link gains a `title`, and the foot
  keeps only the status dot (its full text stays in the pill's `title`).
- Below 900 px the rail becomes a drawer behind the band's hamburger, with a scrim, Escape to
  close, and a full-width rail (icons without labels in an overlay are unusable).
- `setActivePath(path?)` re-marks the current item. `popstate`, `hashchange` and clicks on rail
  links are handled for you; **a pushState router must call it** after it renders, because
  `history.pushState` fires no event and the kit will not monkey-patch `History` to invent one.
- `setNavBadge(label, n)` puts a count on a nav item.
- `brand-base` (default `/ui/brand`) is where the shell looks for the wordmark, for products that
  mount the kit somewhere else. Next.js products must copy `ui/brand/` into `public/ui/brand/`.
- `#main` is the content region and `#aragLive` is the screen's one polite live region.
  `announce(msg)` writes to it, and creates it if a product renders its own shell — it is never a
  silent no-op.

CSS-only equivalents, if you render the shell yourself: `.arag-app[data-rail]` > `.arag-appband` +
`.body` > `.arag-rail` (`.ident`, `.arag-railnav`, `.foot`) + `.arag-main` > `.arag-content`.

---

## Components

| Class / API | What it is |
| --- | --- |
| `.arag-pagehead` (`.row`, `.sub`, `.actions`) | page header with title, subtitle and actions |
| `.arag-breadcrumb` | `<ol>` trail, last item `aria-current="page"` |
| `.arag-tabs` | tabs — **`<button>` and `<a role="tab">` both styled**; `wireTabs(list, panel)` adds Left/Right/Home/End/Space |
| `.arag-filterbar`, `.arag-search`, `.arag-filterchip` | search + selects + removable filter chips |
| `.arag-datatable` | framed table: sticky header, `th[data-sort]` + `aria-sort`, `tr[aria-selected]`, `[aria-busy]` stale-refresh bar |
| `.arag-bulkbar` | selection bar that replaces the header row in place, so nothing shifts |
| `.arag-pagination` | range + prev/next |
| `.arag-drawer` (`.wide`, `.left`), `.arag-inspector` | right-hand drawer, or a docked inspector |
| `.arag-confirm` | destructive confirmation, incl. the typed-confirm variant |
| `.arag-emptystate` | teach-me empty and error states |
| `.arag-statstrip` | a row of linked counts (each tile is a filter) |
| `.arag-segmented` | one-of-N control; `wireSegmented(root, onChange)` |
| `.arag-skeleton` (`.row`, `.title`) | shimmer placeholder |
| `.arag-snippet` | dark code block with a copy button; `wireCopy(root)` |
| `.arag-timeline` | vertical event list with a rail and dots |
| `.arag-split` (`.even`, `.rail-left`, `.sticky`) | two-column content |
| `.arag-menu` | kebab/row-actions popover; `menuButton(items, {ariaLabel})` |
| `.arag-popover`, `tour(steps)` | explanatory popover; guided tour overlay |
| `.arag-signin` (`.standalone`) | centred sign-in card with a reserved error slot. Inside a shell the band carries the wordmark, so the card's is hidden; `.standalone` is the bandless, full-bleed-ink form where the card carries the only wordmark |
| `.arag-meter`, `.arag-pill-live`, `.arag-chips`, `.arag-prose`, `.arag-truncate` | small shared pieces |

Still here from 0.1.x: `.arag-card`, `.arag-kpi`, `.arag-btn` (+ `secondary|ghost|danger|on-dark|sm|lg`),
forms, `.arag-chip`, `.arag-status[data-state]`, `.arag-table`, `.arag-kv`, `.arag-steps`,
`.arag-dropzone`, alerts/toast/modal, `.arag-json`, `.arag-log`, chat bubbles + citations,
`.arag-progress`, `.arag-grid`, `.arag-row`, `.arag-stack`, `.arag-container`, and the two-band
`.arag-band`/`.arag-header`/`.arag-footer` shell.

### Data table contract

`wireTable(root, { onSort, onSelect, onOpen, onPage, selected })` wires an already-rendered table —
you own the markup, the kit owns the behaviour:

```html
<div class="arag-datatable" id="table">
  <div class="arag-bulkbar" data-bulkbar hidden>
    <span class="count" data-bulk-count aria-live="polite">0 selected</span>…
  </div>
  <div class="scroll"><table>
    <thead><tr>
      <th class="check"><input type="checkbox" data-check-all aria-label="Select all" /></th>
      <th data-sort="title" aria-sort="none"><button type="button">Title<svg class="sortic">…</svg></button></th>
    </tr></thead>
    <tbody>
      <tr data-id="42" data-href="/documents/42" tabindex="0">
        <td class="check"><input type="checkbox" data-check="42" aria-label="Select Invoice" /></td>
        <td><a class="cell-title" href="/documents/42">Invoice</a><span class="cell-sub">…</span></td>
      </tr>
    </tbody>
  </table></div>
  <nav class="arag-pagination"><button data-page="prev">Previous</button><button data-page="next">Next</button></nav>
</div>
```

`wireTable`, `wireTabs` and `wireSegmented` are all idempotent and fully delegated: call one again
on the same root after a re-render and it swaps the callback rather than binding a second set of
listeners.

Select-all gets a real `indeterminate` state, the selection count is announced politely, and
whole-row click is a convenience only — the first cell always holds a real anchor, and clicks on a
control, link or the checkbox cell never navigate.

### Overlays

**`title`, `sub`, `body`, `foot` and a popover's `html` are HTML**, not text — a drawer head carries
chips and its body carries a form. Escape anything that came from a user or from ARAG with `esc()`
before interpolating it. (`confirmLabel`, `typed` and a tour step's `title` are escaped for you.)

`openDrawer({ title, body, foot, sub, wide, side, onClose })` and
`confirmDialog({ title, body, confirmLabel, typed, danger })` both trap focus, close on Escape and
on the scrim, return focus to the trigger, and make the page behind them `inert`. The confirm
dialog is `role="alertdialog"`, focus starts on **Cancel**, and `typed: "delete 12"` keeps the
destructive button disabled until the text matches exactly. `tour()` is deliberately *not* modal —
its scrim does not capture clicks, so the user can do the thing the step describes — but it
registers as the open overlay, so opening a drawer or a confirm ends it.

### Icons

Inline SVG only: never an icon font, a sprite sheet, or an emoji. One 20×20 grid, `fill="none"`,
`stroke="currentColor"`, round caps and joins, and a stroke width scaled with the render size so
optical weight stays constant from 14 px to 32 px.

```js
icon("search", { size: 18 })                 // decorative: aria-hidden
icon("trash", { label: "Delete document" })  // the only label: role="img" + aria-label
```

`<arag-icon name="search" size="18">` is the declarative form. `iconNames` lists the core set:

> document · folder · upload · download · search · filter · sort · chevron-down · chevron-up ·
> chevron-right · chevron-left · check · plus · x · menu · more-horizontal · settings · shield ·
> key · plug · chart · clock · users · trash · refresh · play · copy · external-link · info ·
> alert-triangle · jobs · logs · layers · home · book

Unknown names render nothing rather than a mystery glyph. Products add their own domain icons in
the same shape — the kit owns the convention, not every icon.

### Pure helpers (unit-tested, no DOM)

`sortRows`, `nextSort`, `paginate`, `filterRows`, `parseNav`, `activeNavHref`, `placeCard`,
`brandingPlan`, `brandingVars`, `icon`, `esc`, `fmtMs`, `fmtBytes`, `fmtRelative`, `emptyState`,
`errorState`, `skeletonRows`, `snippet`. `sortRows` is stable, case-insensitive, numeric-aware and
always sorts empty cells **last in both directions** — a missing value is not "smallest".

---

## Branding hook

`readBranding(env, defaults)` (platform) parses `BRAND_*`; products expose it at
`GET /api/v1/branding`; the shells fetch it (attribute `branding-src`, `none` to skip).

**Any element in any shell can opt in** — this is the 0.2.0 fix for products that render their own
chrome and previously had to re-implement `applyBranding()`:

| Attribute | Effect |
| --- | --- |
| `data-brand-name` | `textContent` ← `productName` |
| `data-brand-tagline` | `textContent` ← `tagline`; hidden when empty |
| `data-brand-logo` | `src`/`alt` ← `logoUrl`; hidden (and `src` removed) when empty |
| `data-brand-footer` | `textContent` ← `footerText` |
| `data-docs-link` | `href` ← `docsUrl` |
| `data-powered-by`, `data-powered-by-credit` | hidden when `poweredBy === false` |

`applyBranding(b, root = document)` also writes `--arag-brand-500/600/700` and
`--arag-accent-400/500` from `primaryColor`/`accentColor` — surfaces, text and status colours are
contrast-tuned and never move — sets `document.title`, and collapses `--arag-band-h` to `0px` when
the Progress signature is switched off. `brandingPlan(b)` returns the operation list if you want to
apply it yourself. Note that the payload is **authoritative**: pass your product's name and tagline
as `readBranding` defaults, not only as shell attributes, or an unset `BRAND_TAGLINE` will blank a
tagline the markup shipped with.

`ui/favicon.svg` is the default icon; `ui/brand/` carries the official wordmarks.

---

## Specificity

Base element styling — links, headings, paragraphs, `code`/`pre` — is wrapped in `:where()` so it
weighs zero and **any component class wins over it**. Before 0.2.0, `.arag a` (0,1,1) out-specified
`.arag-btn` (0,1,0) and `.arag pre` out-specified `.arag-snippet`, so an anchor-button rendered
blue-on-blue and a dark snippet rendered as a pale box; every product carried a local work-around.
Keep new base rules inside `:where()`, and keep component rules as plain classes.
