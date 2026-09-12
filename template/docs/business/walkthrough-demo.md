# Walkthrough — the guided path through the product

Ten minutes, no credentials needed: `make dev` boots against the mock ARAG.

1. **Overview** (`/`). With an empty Knowledge Box this is a first-run screen that teaches rather
   than an empty table: one action, *Create a note*. Once there is data it becomes counts (Notes,
   Ready, Processing, Failed — each tile is a filter), the five most recent notes, and the
   connection state.
2. **Create a note.** The drawer is the one creation path, reachable from the overview and the
   list. Creating ingests the text into the Knowledge Box as one ARAG resource and returns a job.
3. **The record** (`/notes/{id}`). You land here straight from creating. The *Overview* tab is the
   record itself plus the one API call that returns it; *Processing* streams the ingest job's
   stages live; *Ask this note* scopes a question to this resource only.
4. **The list** (`/notes`). Search by title, filter by status, sort any column, select rows. The
   bulk bar replaces the header row in place, and deleting more than one note asks you to type the
   confirmation — there is no undo on the far side.
5. **Ask** (`/ask`). The same grounded answer across every note, with citations and the elapsed time.
6. **Settings** (`/settings`). How the deployment is connected, what the white-label branding
   currently resolves to, how to call the API with a key, and the danger zone.
7. **Operator console** (`/admin/`). Sign in with `ADMIN_TOKEN`. Same shell, own navigation:
   health and usage, the effective configuration with secrets redacted, the job table with a
   detail pane, and the log ring buffer with level and text filters.

Every screen is one public endpoint away — open `/api/v1/docs` beside the app and follow along.

## White-label it

Set `BRAND_PRODUCT_NAME`, `BRAND_TAGLINE`, `BRAND_LOGO_URL`, `BRAND_PRIMARY_COLOR` and restart. The
name, tagline and partner mark land in the rail's identity block; the colour retints the action
ramp. `BRAND_POWERED_BY=0` removes the Progress band entirely — attribution stays in `LICENSE` and
`NOTICE`.
