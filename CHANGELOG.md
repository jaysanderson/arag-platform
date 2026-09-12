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
