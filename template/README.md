# __PRODUCT_TITLE__

Open-source product built on **Progress Agentic RAG (ARAG)**. API-first: every capability is a versioned REST endpoint with an OpenAPI 3.1 spec; the workspace and the operator console consume only that API.

## Quick start

```bash
make install            # bun install (dev tooling only; no npm)
cp .env.example .env    # add ARAG_KB_ID / ARAG_API_KEY / ARAG_REGION — or leave empty to run on the mock ARAG
make dev                # http://localhost:8080 (workspace) · /admin/ (operator console) · /api/v1/docs
make check              # lint + types + tests with coverage
make e2e                # Playwright journeys + the app shell at 1440 and 390 px, on a mock-backed server
```

Surfaces:

| Screen | Path | What it is |
| --- | --- | --- |
| Overview | `/` | counts, recent notes, first-run empty state |
| Notes | `/notes` | list with search, status filter, sorting, selection, bulk delete and pagination |
| Note | `/notes/{id}` | the record, with Overview / Processing / Ask tabs |
| Ask | `/ask` | grounded answers with citations across every note |
| Settings | `/settings` | connection, white-label branding, API access, danger zone |
| Operator console | `/admin/` | same shell, own navigation (needs `ADMIN_TOKEN`) |
| API | `/api/v1` | `/api/v1/docs` (Redoc), `/api/v1/swagger` |

The front end is one document with real URLs (`app.static("/", …, { fallback: true })`) built
entirely from the shared UI kit — see `vendor/arag-platform/docs/ui-kit.md`. Add **domain**
components locally; do not re-cut the shell, the table, the drawer or the confirm dialog.

## Documentation

- Developer: [docs/developer/quickstart.md](docs/developer/quickstart.md) · [API reference](docs/developer/api-reference.md) · [examples](docs/developer/examples.md) · [extension points](docs/developer/extension-points.md) · [local dev](docs/developer/local-dev.md)
- Solution architect: [architecture](docs/architecture/architecture.md) · [ARAG integration](docs/architecture/arag-integration.md) · [security model](docs/architecture/security-model.md) · [deployment](docs/architecture/deployment-topologies.md)
- Business: [overview](docs/business/overview.md) · [demo walkthrough](docs/business/walkthrough-demo.md) · [FAQ](docs/business/faq.md)
- Product marketing: [positioning](docs/product-marketing/positioning.md)
- Enablement: [developer lab](enablement/developer-track/LAB.md) · [architect workshop](enablement/architect-track/WORKSHOP.md)
- Showcase: [script](showcase/SCRIPT.md) · [storyboard](showcase/STORYBOARD.md)

## Deploy (Fly.io)

```bash
fly launch --no-deploy --copy-config --name __PRODUCT_SLUG__
fly volumes create data --size 1 --region iad
fly secrets set ARAG_KB_ID=… ARAG_API_KEY=… ARAG_REGION=aws-us-east-2-1 ADMIN_TOKEN=$(openssl rand -hex 24)
fly deploy
```

Licence: Apache-2.0. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CHANGELOG.md](CHANGELOG.md).
