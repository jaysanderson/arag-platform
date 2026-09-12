# Product repo template

`template/` is a complete, runnable product skeleton (a tiny "notes" service over ARAG) that already satisfies STANDARDS.md: OpenAPI-first API, admin panel, demo app, mock ARAG, unit/integration/contract/e2e tests, Biome, CI, Dockerfile, fly.toml, docs/enablement/showcase skeletons.

```bash
make new-product NAME=my-product DIR=../my-product
cd ../my-product && make install && make dev        # http://localhost:8080 (ARAG_MOCK=1 by default when no creds)
make check && make e2e
```

Replace `src/openapi.ts`, `src/routes/*`, `src/services/*`, `public/`, `admin/` with the product; keep the wiring in `src/server.ts` and the test scaffolding. `make sync-platform` (from the platform repo) refreshes `vendor/arag-platform/`.

## Known environment quirks

- Playwright 1.52's ESM TypeScript loader hangs on Node ≥ 26 for packages with `"type": "module"`. The template sets `PW_DISABLE_TS_ESM=1` on `make e2e` / `make showcase` (and CI), which makes Playwright use its CommonJS transform instead. Playwright itself is unaffected.
- Local browsers: `channel: "chrome"` (Google Chrome) unless `PW_CHANNEL` is set; CI downloads Chromium.
- Next.js products: Next loads `.env`/`.env.local` itself before product code runs, so `ENV_FILE=/dev/null` does not isolate them — blank `ARAG_KB_ID`, `ARAG_API_KEY` and `ARAG_BASE_URL` explicitly in the Playwright web-server command and assert it in a test.
- Per-route `rateLimit` only tightens (it is an extra bucket on top of the global limit); loosen the global limit for routes such as media scrubbing instead.
