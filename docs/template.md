# Product repo template

`template/` is a complete, runnable product skeleton (a tiny "notes" service over ARAG) that already satisfies STANDARDS.md: OpenAPI-first API, admin panel, demo app, mock ARAG, unit/integration/contract/e2e tests, Biome, CI, Dockerfile, fly.toml, docs/enablement/showcase skeletons.

```bash
make new-product NAME=my-product DIR=../my-product
cd ../my-product && make install && make dev        # http://localhost:8080 (ARAG_MOCK=1 by default when no creds)
make check && make e2e
```

Replace `src/openapi.ts`, `src/routes/*`, `src/services/*`, `public/`, `admin/` with the product; keep the wiring in `src/server.ts` and the test scaffolding. `make sync-platform` (from the platform repo) refreshes `vendor/arag-platform/`.
