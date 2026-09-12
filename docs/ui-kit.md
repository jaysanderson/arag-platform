# UI kit

`ui/arag-ui.css` — design tokens (Progress ARAG palette, type, radius, shadow; dark theme via `[data-theme=dark]`) and components: shell (`.arag-band`, `.arag-header`, `.arag-nav`, `.arag-main`, `.arag-footer`), layout (`.arag-container`, `.arag-grid.cols-N/.split`, `.arag-row`, `.arag-stack`), `.arag-card`, `.arag-kpi`, buttons (`.arag-btn` + `secondary|ghost|danger|sm|lg`), forms (`.arag-field`, `.arag-input`, `.arag-select`, `.arag-textarea`), `.arag-chip` (ok|warn|danger|info|neutral|outline), `.arag-status[data-state]`, `.arag-table`, `.arag-kv`, `.arag-steps` (pipeline stepper: active|ok|error|skip), `.arag-dropzone`, alerts/toast/empty/modal, `.arag-json`, `.arag-log`, chat bubbles + citations, progress, tabs.

`ui/arag-ui.js` (ES module, no build) — web components:
- `<arag-shell product="…" tagline="…" nav="Demo=/,Admin=/admin" admin-href="/admin" docs-href="/api/v1/docs">…content…</arag-shell>`
- `<arag-status endpoint="/readyz" label="service">` live pill
- `<arag-json src="/api/v1/…">` or `.data = obj` pretty viewer
- `<arag-log src="/api/v1/admin/logs" limit="100" level="warn" refresh="5000">`
- `<arag-health src="/api/v1/admin/health">` admin card (service + KB connectivity)
- `<arag-job-timeline src="/api/v1/jobs/{id}" events-src="/api/v1/jobs/{id}/events">` live stepper

Helpers on `window.aragUI`: `api(path, {json, headers})` (problem-aware fetch), `toast(msg, kind)`, `sse(url, {event: fn})`, `esc`, `fmtMs`, `fmtBytes`, `highlightJson`.

Serve from a product: `app.static("/ui", "./vendor/arag-platform/ui")` then `<link rel="stylesheet" href="/ui/arag-ui.css">` and `<script type="module" src="/ui/arag-ui.js"></script>`. Next.js products import the CSS globally and copy `arag-ui.js` into `public/ui/`.

## Branding

`readBranding(env, defaults)` (platform) parses `BRAND_*` variables; products expose it at `GET /api/v1/branding`. `<arag-shell>` fetches it (attribute `branding-src`, `none` to skip) and `applyBranding(b)` sets the CSS variables, product name, logo, powered-by band/credit, footer and docs link. `ui/favicon.svg` is the default icon.
