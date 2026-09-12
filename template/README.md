# __PRODUCT_TITLE__

Open-source product built on **Progress Agentic RAG (ARAG)**. API-first: every capability is a versioned REST endpoint with an OpenAPI 3.1 spec; the demo app and admin panel consume only that API.

## Quick start

```bash
make install            # bun install (dev tooling only; no npm)
cp .env.example .env    # add ARAG_KB_ID / ARAG_API_KEY / ARAG_REGION — or leave empty to run on the mock ARAG
make dev                # http://localhost:8080  (demo)  · /admin/ (admin)  · /api/v1/docs (API reference)
make check              # lint + types + tests with coverage
make e2e                # Playwright (demo + admin) on a mock-backed server
```

Surfaces: **Demo** `/` · **Admin** `/admin/` (needs `ADMIN_TOKEN`) · **API** `/api/v1` (`/api/v1/docs` Redoc, `/api/v1/swagger`).

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
