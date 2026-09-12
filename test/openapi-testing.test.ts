import assert from "node:assert/strict";
import { test } from "node:test";
import { readEnv } from "../src/config/env.ts";
import { App } from "../src/http/app.ts";
import { Logger } from "../src/log/logger.ts";
import {
  buildOpenApi,
  jsonBody,
  jsonResponse,
  operationSchemas,
  pageSchema,
  schemaAt,
} from "../src/openapi/builder.ts";
import {
  checkResponse,
  lintSpec,
  missingFromSpec,
  toOpenApiPath,
  withMockArag,
} from "../src/testing/index.ts";

const doc = buildOpenApi({
  info: { title: "Demo", version: "1.0.0" },
  tags: [{ name: "things" }],
  schemas: {
    Thing: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    ThingPage: pageSchema("#/components/schemas/Thing"),
  },
  paths: {
    "/api/v1/things": {
      get: {
        operationId: "listThings",
        tags: ["things"],
        parameters: [{ name: "page", in: "query", schema: { type: "integer" } }],
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/ThingPage" }) },
      },
      post: {
        operationId: "createThing",
        tags: ["things"],
        requestBody: jsonBody({ $ref: "#/components/schemas/Thing" }),
        responses: {
          201: jsonResponse({ $ref: "#/components/schemas/Thing" }),
          400: { $ref: "#/components/responses/Nope" },
        },
      },
    },
    "/api/v1/things/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getThing",
        tags: ["things"],
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/Thing" }) },
      },
    },
  },
});

test("buildOpenApi merges shared components and operationSchemas extracts validators", () => {
  assert.ok(schemaAt(doc, "#/components/schemas/Problem"));
  assert.ok(schemaAt(doc, "#/components/schemas/Job"));
  assert.equal((doc.info as { license: { name: string } }).license.name, "Apache-2.0");
  const s = operationSchemas(doc, "/api/v1/things/{id}", "get");
  assert.deepEqual(s.params, {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  });
  const q = operationSchemas(doc, "/api/v1/things", "get");
  assert.equal((q.query as { properties: { page: unknown } }).properties.page !== undefined, true);
  assert.deepEqual(operationSchemas(doc, "/api/v1/things", "post").body, {
    $ref: "#/components/schemas/Thing",
  });
});

test("lintSpec finds unresolvable refs; missingFromSpec finds undocumented routes; checkResponse validates", async () => {
  const problems = lintSpec(doc);
  assert.ok(problems.some((p) => p.includes("unresolvable $ref #/components/responses/Nope")));
  const app = new App({ env: readEnv({ RATE_LIMIT_RPS: "0" }), log: new Logger({ write: () => undefined }) });
  app.docs("/api/v1", doc);
  app.get("/api/v1/things", () => ({}));
  app.get("/api/v1/things/:id", () => ({}));
  app.delete("/api/v1/things/:id", () => ({}));
  app.get("/healthz", () => ({}), { operationId: "healthz" });
  assert.deepEqual(missingFromSpec(app, doc), ["DELETE /api/v1/things/:id"]);
  assert.equal(toOpenApiPath("/a/:id/b/:rest*"), "/a/{id}/b/{rest}");
  assert.equal(checkResponse(doc, "/api/v1/things/{id}", "get", 200, { id: "x" }).length, 0);
  assert.equal(checkResponse(doc, "/api/v1/things/{id}", "get", 200, {}).length, 1);
  assert.match(checkResponse(doc, "/api/v1/things/{id}", "get", 204, {})[0]!.message, /no response declared/);
  assert.equal(
    checkResponse(doc, "/api/v1/things", "get", 200, {
      items: [{ id: "1" }],
      page: 1,
      page_size: 10,
      total: 1,
    }).length,
    0,
  );
  const n = await withMockArag(async (m) => Object.keys(m.mock.resources).length);
  assert.equal(n, 0);
});
