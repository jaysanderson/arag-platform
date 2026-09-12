# OpenAPI, validation and contract tests

Author the document in `src/openapi.ts` with `buildOpenApi({ info, tags, paths, schemas })`. Shared components (Problem, Job, JobEvent, LogRecord, Health, security schemes, `standardResponses`, `pageSchema`) are merged in. Helpers: `jsonBody(schema)`, `jsonResponse(schema)`, `operationSchemas(doc, path, method)` (returns `{body, query, params}` validators for `app.route(..., { validate })`), `schemaAt(doc, "#/…")`.

Validation uses `src/validation/jsonschema.ts` (JSON Schema 2020-12 subset: types, enum/const, required, properties, additionalProperties, items, min/max, length, pattern, formats uuid/date-time/date/email/uri, nullable, allOf/anyOf/oneOf/not, local `$ref`). Query and path parameters are coerced (integers, numbers, booleans, comma or repeated arrays).

Contract tests (`src/testing`):
```ts
assert.deepEqual(lintSpec(openapi), []);                    // operationIds, responses, tags, refs
assert.deepEqual(missingFromSpec(app, openapi), []);        // every /api/v1 route is documented
const r = await client.get("/api/v1/items/1");
assert.deepEqual(checkResponse(openapi, "/api/v1/items/{id}", "get", 200, r.json), []);
```

Generate markdown: `node vendor/arag-platform/scripts/openapi-to-md.ts http://localhost:8080/api/v1/openapi.json docs/developer/api-reference.md`.
