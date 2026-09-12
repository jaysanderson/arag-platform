# ARAG Platform — task runner. bun is used ONLY to install dev tooling (never npm).
BUN ?= bun
NODE ?= node

.PHONY: help install test coverage lint format typecheck check mock sync-platform new-product

help:
	@echo "make install       install dev tooling with bun (exact pins)"
	@echo "make test          run unit + integration tests (node:test)"
	@echo "make coverage      run tests with coverage (target >= 80% on src/)"
	@echo "make lint          biome check"
	@echo "make format        biome format --write"
	@echo "make typecheck     tsc --noEmit"
	@echo "make check         lint + typecheck + coverage"
	@echo "make mock          run the mock ARAG server on :8790"
	@echo "make sync-platform TARGET=../arag-doc-processing   vendor this platform into a product repo"
	@echo "make new-product   NAME=my-product DIR=../my-product   scaffold a product repo from template/"

install:
	$(BUN) install --frozen-lockfile || $(BUN) install

test:
	$(NODE) --test --test-reporter=spec 'test/**/*.test.ts'

coverage:
	$(NODE) --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-exclude='src/arag/mock/fixtures.ts' --test-coverage-lines=80 'test/**/*.test.ts'

lint:
	$(BUN)x biome check .

format:
	$(BUN)x biome format --write .

typecheck:
	$(BUN)x tsc --noEmit -p tsconfig.json

check: lint typecheck coverage

mock:
	$(NODE) src/arag/mock/cli.ts

sync-platform:
	@test -n "$(TARGET)" || (echo "Usage: make sync-platform TARGET=<product repo dir>"; exit 1)
	sh scripts/sync-platform.sh $(TARGET)

new-product:
	@test -n "$(NAME)" -a -n "$(DIR)" || (echo "Usage: make new-product NAME=<slug> DIR=<dir>"; exit 1)
	sh scripts/new-product.sh $(NAME) $(DIR)
