# __PRODUCT_TITLE__ — task runner. bun installs dev tooling only; npm is never used.
BUN ?= bun
NODE ?= node
.PHONY: help install dev start test coverage e2e lint typecheck check docs showcase docker fly-validate mock
help:
	@echo "make install    bun install (dev tooling, exact pins)"
	@echo "make dev        run with --watch on :8080 (ARAG_MOCK=1 if no credentials in .env)"
	@echo "make start      run in production mode"
	@echo "make test       unit + integration + contract tests (node:test, mock ARAG)"
	@echo "make coverage   tests with coverage gate (80% lines on src/)"
	@echo "make e2e        Playwright (demo + admin) against a mock-backed server"
	@echo "make check      lint + typecheck + coverage"
	@echo "make docs       regenerate docs/developer/api-reference.md from the running server"
	@echo "make showcase   record the showcase walkthrough (video + screenshots) into showcase/out"
	@echo "make docker     build the container image"
	@echo "make fly-validate  validate fly.toml"
install:
	$(BUN) install --frozen-lockfile || $(BUN) install
dev:
	@test -f .env || cp .env.example .env
	@grep -q "^ARAG_API_KEY=.\+" .env 2>/dev/null && $(NODE) --watch src/index.ts || ARAG_MOCK=1 $(NODE) --watch src/index.ts
start:
	$(NODE) src/index.ts
test:
	$(NODE) --test --test-reporter=spec 'test/*.test.ts'
coverage:
	$(NODE) --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-lines=80 'test/*.test.ts'
# PW_DISABLE_TS_ESM=1: Playwright's ESM TypeScript loader hangs on Node >= 26 (module.register deprecation); the CJS transform works everywhere.
e2e:
	PW_DISABLE_TS_ESM=1 $(BUN)x playwright test
lint:
	$(BUN)x biome check .
typecheck:
	$(BUN)x tsc --noEmit -p tsconfig.json
check: lint typecheck coverage
docs:
	$(NODE) vendor/arag-platform/scripts/openapi-to-md.ts http://localhost:$${PORT:-8080}/api/v1/openapi.json docs/developer/api-reference.md
showcase:
	PW_DISABLE_TS_ESM=1 SHOWCASE=1 $(BUN)x playwright test showcase/record.spec.ts --config playwright.config.ts
docker:
	docker build -t __PRODUCT_SLUG__:local .
fly-validate:
	fly config validate -c fly.toml
mock:
	MOCK_SEED=docs $(NODE) vendor/arag-platform/src/arag/mock/cli.ts
