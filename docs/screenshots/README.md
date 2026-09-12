# UI kit reference screenshots

The scaffolded reference product (`sh scripts/new-product.sh …`) running against the mock ARAG, so
every one of these is the kit as a fourth partner product would receive it — no product-local CSS.
Regenerate by scaffolding a product and driving it with Playwright (see the shot specs in
`template/test/e2e/`).

| File | Shows |
| --- | --- |
| `kit-1440-00-first-run.png` | empty Knowledge Box: the empty state that teaches, one action |
| `kit-1440-01-overview.png` | rail shell, stat strip (each tile a filter), recent list |
| `kit-1440-02-list.png` | filter bar, data table, pagination |
| `kit-1440-03-list-bulk.png` | selection + the bulk bar replacing the header row in place |
| `kit-1440-04-detail-tabs.png` | breadcrumb, page header, anchor tabs, snippet with copy |
| `kit-1440-05-settings.png` | settings sections incl. the branding "effective values" pairing |
| `kit-1440-06-drawer.png` | right-hand drawer |
| `kit-1440-07-confirm-typed.png` | destructive confirm, typed variant, focus on Cancel |
| `kit-1440-08-rail-collapsed.png` | collapsed icon rail (labels keep their accessible names) |
| `kit-1440-09-signin.png` | sign-in card — one wordmark on the screen, in the band |
| `kit-1440-10-admin.png` | operator console: same shell, own navigation |
| `kit-1440-11-admin-jobs.png` | admin job table + detail pane |
| `kit-1440-12-empty-filtered.png` | the other empty state: filters matched nothing |
| `kit-1440-13-rail-light-segmented.png` | `rail="light"` family + segmented control |
| `kit-1440-14-dark.png` | `[data-theme="dark"]` — the same screen, tokens swapped |
| `kit-390-01-overview.png` … `kit-390-04-settings.png` | the same shell at phone width |
| `kit-390-02-rail-drawer.png` | the rail as a scrim-backed drawer |
| `kit-390-05-list-scrolled.png` | the table scrolled inside its own box (edge shade flips sides) |
