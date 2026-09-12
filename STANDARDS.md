# STANDARDS.md — engineering standards for ARAG products

These standards apply to every product built on this platform (Document Processing, Call Analysis, VoiceBridge and future products). They are enforced by the platform toolkit, the repo template, `make check` and CI. Deviations are recorded in the product's `DECISIONS.md`.

## 1. Repository layout

```
<repo>/
  README.md  LICENSE (Apache-2.0)  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md  CHANGELOG.md  AUDIT.md  DECISIONS.md
  .github/workflows/ci.yml  .github/ISSUE_TEMPLATE/*.md  .github/PULL_REQUEST_TEMPLATE.md
  Makefile  Dockerfile  fly.toml  .env.example  package.json  bun.lock  biome.json  tsconfig.json  playwright.config.ts
  src/            product code (Node) or app/+lib/ (Next.js)
    openapi.ts    the OpenAPI 3.1 document (single source of truth for the public API)
    server.ts     App wiring: middleware, routes, docs, static, admin
    routes/       one module per resource
    services/     domain logic (ARAG orchestration), no HTTP types
  public/         demo app (static, framework-free) — consumes only /api/v1
  admin/          admin panel (static) — consumes only /api/v1 (+ /api/v1/admin)
  vendor/arag-platform/   vendored copy of this platform (see §9), never edited in place
  test/           unit, integration (mock ARAG), contract, e2e (Playwright)
  docs/           developer/ architecture/ business/ product-marketing/  (+ README.md index)
  enablement/     developer-track/ architect-track/
  showcase/       SCRIPT.md STORYBOARD.md record.spec.ts out/
  data/           DATA_DIR default (gitignored)
```

## 2. API conventions

- **Versioning:** every public route is under `/api/v1`. Breaking changes create `/api/v2`; `v1` keeps working for one minor release cycle. Non-breaking additions are allowed in place. The OpenAPI `info.version` follows the repo's semver.
- **Resources, not verbs:** `POST /api/v1/documents` (create), `GET /api/v1/documents/{id}`, `GET /api/v1/documents` (list). Actions that are not CRUD are sub-resources: `POST /api/v1/documents/{id}/ask`. Long work returns `202 Accepted` with a **Job** (`/api/v1/jobs/{id}`, events at `/api/v1/jobs/{id}/events` as SSE).
- **Naming:** kebab-case paths, snake_case query parameters, camelCase JSON fields (product data) — ARAG passthrough fields keep ARAG's snake_case and are documented as such.
- **Lists** return `{ items, page, page_size, total, next_page }` and accept `page`, `page_size` (max 200).
- **Ids** are opaque strings. ARAG resource ids are surfaced as `resourceId` where relevant.
- **Content types:** JSON in/out; uploads accept `multipart/form-data` (field `file`) or a raw body with `X-Filename`. Streams are `text/event-stream` (SSE) or `application/x-ndjson` (LLM answer streams).
- **Status codes:** 200 OK, 201 Created (with `Location`), 202 Accepted (job), 204 No Content, 400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict, 413, 415, 429 (`Retry-After`), 502 upstream (ARAG) error, 504 upstream timeout.
- **Idempotency:** `PUT` replaces; `POST` creates; provisioning endpoints are idempotent by design (safe to re-run).
- **Every route is described in `openapi.ts` before it is implemented**; the contract test `missingFromSpec()` fails the build otherwise. Every operation has `operationId`, `tags`, `summary`, and documented error responses via `standardResponses`.
- **Docs:** `/api/v1/openapi.json`, `/api/v1/docs` (Redoc), `/api/v1/swagger` (Swagger UI, try-it-out).

## 3. Error format

RFC 9457 `application/problem+json`:

```json
{ "type": "https://arag.dev/problems/validation", "title": "Validation failed", "status": 400,
  "detail": "Invalid body: /name is required", "instance": "/api/v1/documents", "requestId": "…",
  "errors": [{ "path": "/name", "message": "is required" }] }
```

`type` values: `validation`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `too-many-requests`, `upstream`, `upstream-timeout`, `internal-server-error`. ARAG failures never leak the KB URL, token or raw upstream body to clients; the requestId links to server logs. In production, 500 details are generic.

## 4. Authentication and authorisation

- `ADMIN_TOKEN` protects `/admin` and `/api/v1/admin/*` (bearer or `arag_admin` cookie set by the login page). Unset ⇒ admin routes answer 403 with an explanatory detail.
- `API_KEYS` (comma-separated) — when set, `/api/v1/*` routes marked `auth: "api"` require `X-API-Key` or `Authorization: Bearer`. The demo UI obtains a signed same-origin session cookie (`arag_session`) from `POST /api/v1/session` (which is itself rate-limited), so demos keep working without exposing keys to the browser.
- Health, OpenAPI and docs routes are always public.
- Secrets come only from environment variables (`.env` locally, Fly secrets in production); never from files in the repo, never sent to browsers, never logged (the logger redacts `*token*`, `*key*`, `*secret*`, `*password*`, `authorization`, `cookie`).

## 5. Security baseline

Security headers (`securityHeaders()`), CORS allowlist (`ALLOWED_ORIGINS`), per-IP/per-key token-bucket rate limiting (`RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`), body size limits (`MAX_BODY_BYTES`), OpenAPI-driven input validation, upload MIME allowlists, path-traversal-safe static serving, `bun audit` in CI, pinned dependencies, non-root Docker user, HSTS in production. Each product documents its threat model in `docs/architecture/security-model.md`.

## 6. Configuration

Common variables (all products): `PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL`, `DATA_DIR`, `ADMIN_TOKEN`, `API_KEYS`, `ALLOWED_ORIGINS`, `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`, `MAX_BODY_BYTES`, `PUBLIC_URL`, and ARAG: `ARAG_KB_ID`, `ARAG_API_KEY`, `ARAG_REGION` (or `ARAG_BASE_URL`), `ARAG_GENERATIVE_MODEL`, `ARAG_RERANKER`, `ARAG_TIMEOUT_MS`, `ARAG_MOCK`. Product-specific variables are prefixed with the product (`DIP_`, `CALLS_`, `VOICE_`). `.env.example` lists every variable with a comment; `assertAragEnv()` fails fast at boot unless `ARAG_MOCK=1`.

## 7. Logging and observability

JSON lines to stdout (`{ts, level, msg, requestId, …}`), one `http` line per request (method, path, status, ms, auth). Levels: debug/info/warn/error. The last 500 records are kept in memory and exposed at `GET /api/v1/admin/logs` (filter by level/contains). ARAG calls are logged with method/path/status/ms (never the token). Products expose `GET /api/v1/admin/usage` (requests, jobs, ARAG calls, tokens where known) and `GET /healthz` / `GET /readyz` (readiness includes an ARAG connection check).

## 8. Testing bar

| Layer | Tool | Requirement |
|---|---|---|
| Unit | `node --test` (Node repos) / Vitest (Next.js) | pure logic, ≥ 80 % line coverage on `src/` core (`make coverage`) |
| Integration | `node --test` + mock ARAG (`startMockArag()`) | every route exercised in-process |
| Contract | `lintSpec()`, `missingFromSpec()`, `checkResponse()` | spec lint clean; every route in spec; success responses validate |
| E2E | Playwright (`channel: chrome` locally, Chromium in CI) | demo happy path + admin login/health/jobs |
| Lint / types | Biome 2, `tsc --noEmit` | zero errors |
| Security | `bun audit` | no high/critical |

`make check` runs lint, typecheck, unit/integration/contract with coverage; `make e2e` runs Playwright; CI runs both on push and PR (Node 22 and 24).

## 9. Platform consumption and versioning

Products vendor the platform (`make sync-platform` from this repo copies `src/` and `ui/` into `vendor/arag-platform/` and writes `PLATFORM_VERSION`). Never edit vendored files; change the platform, bump `PLATFORM_VERSION`, re-sync. Platform semver: MAJOR for breaking client/toolkit changes, MINOR for additions, PATCH for fixes. `CHANGELOG.md` follows Keep a Changelog.

## 10. Code style

TypeScript strict, erasable syntax only (no enums, parameter properties, namespaces) so Node runs it directly. Biome formatting (2 spaces, double quotes, 110 cols). Modules are ESM with explicit `.ts` extensions. Prefer small pure functions in `services/`; HTTP handlers stay thin. Comments explain *why* (especially ARAG behaviours learned live).

## 11. Documentation structure (every repo)

```
docs/README.md               index with links to every page below
docs/developer/              quickstart.md api-reference.md examples.md extension-points.md local-dev.md contributing.md
docs/architecture/           architecture.md arag-integration.md data-flow.md deployment-topologies.md security-model.md scaling.md limits.md
docs/business/               overview.md when-to-use.md walkthrough-demo.md walkthrough-admin.md faq.md
docs/product-marketing/      positioning.md partner-pitch.md launch-blog.md
enablement/developer-track/  LAB.md exercises/ solutions/ knowledge-check.md starter/
enablement/architect-track/  WORKSHOP.md sizing-deployment.md design-review-checklist.md knowledge-check.md
showcase/                    SCRIPT.md STORYBOARD.md record.spec.ts
```

`api-reference.md` is generated from `openapi.json` by `make docs` (platform script `scripts/openapi-to-md.ts`); do not hand-edit it.

## 12. Commit and release hygiene

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), one logical change per commit, `CHANGELOG.md` updated in the same PR, PR template checklist (spec updated, tests added, docs updated, security considered).
