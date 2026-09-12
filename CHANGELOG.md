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
