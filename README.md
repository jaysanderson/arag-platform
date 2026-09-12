# ARAG Platform

Shared platform for open-source products built on **Progress Agentic RAG (ARAG)**: a typed ARAG REST client, a deterministic mock ARAG server, a dependency-free HTTP toolkit (router, OpenAPI validation, problem+json, auth, rate limiting, SSE, static), durable JSON stores and a job manager, a UI kit, engineering standards and a product repo template.

- Zero runtime dependencies. Node ≥ 22.18 runs the TypeScript sources directly.
- Dev tooling is installed with **bun** (never npm) and pinned exactly.
- Everything is tested against the mock ARAG server, so `make check` passes with no credentials.

## Quick start

```bash
make install     # bun install (dev tooling only)
make check       # biome + tsc + tests with coverage
make mock        # standalone mock ARAG on http://127.0.0.1:8790/api/v1 (MOCK_SEED=docs|calls)
```

## What's inside

| Path | Purpose | Docs |
|---|---|---|
| `src/arag/` | `AragClient` (upload, resources, find, catalog, ask NDJSON, search configurations, labelsets, DA tasks, REMi, health) | [docs/arag-client.md](docs/arag-client.md) |
| `src/arag/mock/` | `startMockArag()` — in-process ARAG stand-in with realistic shapes and fixtures | [docs/mock-arag.md](docs/mock-arag.md) |
| `src/http/` | `App` router + middleware, `Ctx`, problem+json, sessions, SSE, multipart, docs pages | [docs/http-toolkit.md](docs/http-toolkit.md) |
| `src/config/`, `src/log/` | typed env + `.env` loader, JSON logger with redaction and ring buffer | [docs/http-toolkit.md](docs/http-toolkit.md) |
| `src/openapi/`, `src/validation/` | OpenAPI 3.1 builders, JSON Schema validator (requests + contract tests) | [docs/openapi.md](docs/openapi.md) |
| `src/store/` | `Store`/`Collection` (DATA_DIR JSON, atomic) and `JobManager` (events, SSE, cancel) | [docs/http-toolkit.md](docs/http-toolkit.md) |
| `src/testing/` | in-process test client, contract checks, spec lint | [docs/openapi.md](docs/openapi.md) |
| `ui/` | `arag-ui.css` tokens/components + `arag-ui.js` web components | [docs/ui-kit.md](docs/ui-kit.md) |
| `template/` | product repo template (`make new-product`) | [docs/template.md](docs/template.md) |
| `STANDARDS.md` | API, error, auth, logging, testing, docs and repo standards | — |

## Using the platform in a product

```bash
make sync-platform TARGET=../my-product     # vendors src/ + ui/ into ../my-product/vendor/arag-platform
```

```ts
import { App, AragClient, readEnv, loadDotEnv, assertAragEnv, securityHeaders, cors, healthRoutes } from "./vendor/arag-platform/src/index.ts";
loadDotEnv();
const env = readEnv();
assertAragEnv(env);
const arag = new AragClient({ kbId: env.arag.kbId, apiKey: env.arag.apiKey, region: env.arag.region, baseUrl: env.arag.baseUrl || undefined });
const app = new App({ env });
app.use(securityHeaders(), cors());
healthRoutes(app, async () => ({ arag: await arag.health() }));
app.get("/api/v1/things/:id", async (ctx) => ({ id: ctx.params.id }), { auth: "api" });
await app.listen();
```

## Licence

Apache-2.0. See [LICENSE](LICENSE), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md).
