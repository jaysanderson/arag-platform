import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readEnv } from "../src/config/env.ts";
import { App, cors, healthRoutes, securityHeaders } from "../src/http/app.ts";
import { parseMultipart } from "../src/http/multipart.ts";
import { HttpError, notFound, validationError } from "../src/http/problem.ts";
import { Logger } from "../src/log/logger.ts";
import { buildOpenApi, jsonBody, jsonResponse } from "../src/openapi/builder.ts";
import { startTestServer } from "../src/testing/index.ts";

const quiet = new Logger({ level: "error", write: () => undefined });

function makeApp(over: Record<string, string> = {}) {
  const env = readEnv({ NODE_ENV: "test", RATE_LIMIT_RPS: "0", ...over });
  return new App({ env, log: quiet });
}

test("routing, params, JSON return, 404/405 problems and request ids", async () => {
  const app = makeApp();
  app.get("/api/v1/things/:id", (ctx) => ({ id: ctx.params.id, q: ctx.query.get("q") }));
  app.post("/api/v1/things", (ctx) => {
    ctx.json(201, { got: ctx.body });
  });
  const c = await startTestServer(app);
  try {
    const r = await c.get("/api/v1/things/42?q=x");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { id: "42", q: "x" });
    assert.ok(r.headers.get("x-request-id"));
    const p = await c.post("/api/v1/things", { a: 1 });
    assert.equal(p.status, 201);
    assert.deepEqual(p.json, { got: { a: 1 } });
    const nf = await c.get("/nope");
    assert.equal(nf.status, 404);
    assert.equal(nf.headers.get("content-type"), "application/problem+json; charset=utf-8");
    assert.equal((nf.json as { title: string }).title, "Not found");
    const mna = await c.request("DELETE", "/api/v1/things/1");
    assert.equal(mna.status, 405);
    const bad = await c.request("POST", "/api/v1/things", {
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    assert.equal(bad.status, 400);
    const rid = await c.get("/api/v1/things/1", { "x-request-id": "abc-123" });
    assert.equal(rid.headers.get("x-request-id"), "abc-123");
  } finally {
    await c.close();
  }
});

test("admin auth, API keys, sessions and rate limiting", async () => {
  const app = makeApp({ ADMIN_TOKEN: "adm", API_KEYS: "k1", RATE_LIMIT_RPS: "1", RATE_LIMIT_BURST: "2" });
  app.get("/api/v1/open", () => ({ ok: true }));
  app.get("/api/v1/keyed", (ctx) => ({ via: ctx.auth.via }), { auth: "api" });
  app.get("/api/v1/admin/x", (ctx) => ({ admin: ctx.auth.admin }), { auth: "admin" });
  app.get(
    "/session",
    (ctx) => {
      ctx.setCookie("arag_session", app.issueSession(60));
      return { ok: true };
    },
    { noRateLimit: true },
  );
  const c = await startTestServer(app);
  try {
    assert.equal((await c.get("/api/v1/keyed")).status, 401);
    assert.equal((await c.get("/api/v1/keyed", { "x-api-key": "k1" })).status, 200);
    assert.deepEqual((await c.get("/api/v1/keyed", { authorization: "Bearer k1" })).json, { via: "api-key" });
    assert.equal((await c.get("/api/v1/admin/x", { authorization: "Bearer k1" })).status, 401);
    assert.deepEqual((await c.get("/api/v1/admin/x", { authorization: "Bearer adm" })).json, { admin: true });
    assert.deepEqual((await c.get("/api/v1/admin/x", { cookie: "arag_admin=adm" })).json, { admin: true });
    const s = await c.get("/session");
    const cookie = s.headers.get("set-cookie")!.split(";")[0]!;
    assert.deepEqual((await c.get("/api/v1/keyed", { cookie })).json, { via: "session" });
    assert.equal(app.verifySession("garbage"), false);
    assert.equal(app.verifySession(undefined), false);
  } finally {
    await c.close();
  }
});

test("rate limiting: burst then 429 with Retry-After; admin bypasses; keys have their own bucket", async () => {
  const app = makeApp({ ADMIN_TOKEN: "adm", API_KEYS: "k1", RATE_LIMIT_RPS: "1", RATE_LIMIT_BURST: "2" });
  app.get("/api/v1/open", () => ({ ok: true }));
  const c = await startTestServer(app);
  try {
    assert.equal((await c.get("/api/v1/open")).status, 200);
    assert.equal((await c.get("/api/v1/open")).status, 200);
    const limited = await c.get("/api/v1/open");
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
    assert.equal((await c.get("/api/v1/open", { authorization: "Bearer adm" })).status, 200);
    assert.equal((await c.get("/api/v1/open", { "x-api-key": "k1" })).status, 200);
  } finally {
    await c.close();
  }
});

test("admin routes are 403 when ADMIN_TOKEN is unset", async () => {
  const app = makeApp();
  app.get("/api/v1/admin/x", () => ({}), { auth: "admin" });
  const c = await startTestServer(app);
  try {
    const r = await c.get("/api/v1/admin/x");
    assert.equal(r.status, 403);
    assert.match((r.json as { detail: string }).detail, /ADMIN_TOKEN/);
  } finally {
    await c.close();
  }
});

test("OpenAPI-driven validation of body, query and params with $ref", async () => {
  const app = makeApp();
  const doc = buildOpenApi({
    info: { title: "T", version: "1" },
    schemas: {
      Thing: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1 }, count: { type: "integer" } },
      },
    },
    paths: {
      "/api/v1/things": {
        post: {
          operationId: "createThing",
          tags: ["t"],
          requestBody: jsonBody({ $ref: "#/components/schemas/Thing" }),
          responses: { 201: jsonResponse({ $ref: "#/components/schemas/Thing" }) },
        },
      },
    },
  });
  app.docs("/api/v1", doc);
  app.post("/api/v1/things", (ctx) => ctx.json(201, ctx.body), {
    validate: { body: { $ref: "#/components/schemas/Thing" } },
  });
  app.get("/api/v1/things", (ctx) => ctx.queryObj, {
    validate: {
      query: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
          tag: { type: "array", items: { type: "string" } },
        },
        required: ["page"],
      },
    },
  });
  app.get("/api/v1/things/:id", (ctx) => ctx.params, {
    validate: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
  });
  const c = await startTestServer(app);
  try {
    const bad = await c.post("/api/v1/things", { count: "x" });
    assert.equal(bad.status, 400);
    const prob = bad.json as { type: string; errors: Array<{ path: string }> };
    assert.equal(prob.type, "https://arag.dev/problems/validation");
    assert.deepEqual(prob.errors.map((e) => e.path).sort(), ["/count", "/name"]);
    assert.equal((await c.post("/api/v1/things", { name: "ok" })).status, 201);
    assert.equal((await c.get("/api/v1/things")).status, 400);
    assert.deepEqual((await c.get("/api/v1/things?page=2&tag=a&tag=b")).json, { page: 2, tag: ["a", "b"] });
    assert.equal((await c.get("/api/v1/things/not-a-uuid")).status, 400);
    assert.equal((await c.get("/api/v1/things/123e4567-e89b-12d3-a456-426614174000")).status, 200);
    const spec = await c.get("/api/v1/openapi.json");
    assert.equal((spec.json as { openapi: string }).openapi, "3.1.0");
    assert.match((await c.get("/api/v1/docs")).text, /redoc/);
    assert.match((await c.get("/api/v1/swagger")).text, /swagger-ui/);
  } finally {
    await c.close();
  }
});

test("static files, traversal guard, HEAD, security headers and CORS preflight", async () => {
  const dir = mkdtempSync(join(tmpdir(), "static-"));
  writeFileSync(join(dir, "index.html"), "<h1>hi</h1>");
  writeFileSync(join(dir, "a.css"), "body{}");
  const app = makeApp({ ALLOWED_ORIGINS: "https://ok.example" });
  app.use(securityHeaders(), cors());
  healthRoutes(app, () => ({ extra: 1 }));
  app.static("/", dir);
  const c = await startTestServer(app);
  try {
    const idx = await c.get("/");
    assert.equal(idx.status, 200);
    assert.match(idx.headers.get("content-type")!, /text\/html/);
    assert.equal(idx.headers.get("x-content-type-options"), "nosniff");
    assert.ok(idx.headers.get("content-security-policy"));
    assert.match((await c.get("/a.css")).headers.get("content-type")!, /text\/css/);
    assert.equal((await c.get("/../etc/passwd")).status, 404);
    assert.equal((await c.get("/..%2f..%2fetc/passwd")).status, 403);
    assert.equal((await c.request("HEAD", "/a.css")).status, 200);
    const pre = await c.request("OPTIONS", "/healthz", { headers: { origin: "https://ok.example" } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), "https://ok.example");
    const denied = await c.get("/healthz", { origin: "https://evil.example" });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
    assert.deepEqual((await c.get("/readyz")).json, { ok: true, extra: 1 });
  } finally {
    await c.close();
  }
});

test("SSE, streaming, raw bodies, multipart and error mapping", async () => {
  const app = makeApp();
  app.get("/events", (ctx) => {
    const sse = ctx.sse();
    sse.send("tick", { n: 1 }, "1");
    sse.comment("c");
    sse.send("done", "bye");
    sse.close();
  });
  app.post("/raw", (ctx) => ({ len: ctx.rawBody?.length, ct: ctx.header("content-type") }), { body: "raw" });
  app.post("/upload", (ctx) => ({
    files: ctx.files.map((f) => [f.field, f.filename, f.contentType, f.data.toString()]),
    fields: ctx.body,
  }));
  app.get("/stream", async (ctx) => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("abc"));
        c.close();
      },
    });
    await ctx.stream(200, { "Content-Type": "text/plain" }, body);
  });
  app.get("/arag-timeout", () => {
    const e = new Error("t") as Error & { name: string; kind: string };
    e.name = "AragError";
    e.kind = "timeout";
    throw e;
  });
  app.get("/arag-401", () => {
    const e = new Error("t") as Error & { name: string; kind: string; status: number };
    e.name = "AragError";
    e.kind = "http";
    e.status = 401;
    throw e;
  });
  app.get("/boom", () => {
    throw new Error("secret detail");
  });
  app.get("/custom", () => {
    throw new HttpError(418, "Teapot", "short and stout", { extra: { brew: true } });
  });
  app.get("/toolarge", () => ({}), { bodyLimit: 5 });
  app.post("/small", () => ({ ok: true }), { bodyLimit: 5, body: "raw" });
  const c = await startTestServer(app);
  try {
    const ev = await c.get("/events");
    assert.match(ev.headers.get("content-type")!, /text\/event-stream/);
    assert.match(ev.text, /id: 1\nevent: tick\ndata: {"n":1}\n\n/);
    assert.match(ev.text, /event: done\ndata: bye/);
    const raw = await c.request("POST", "/raw", {
      body: "12345",
      headers: { "content-type": "application/octet-stream" },
    });
    assert.deepEqual(raw.json, { len: 5, ct: "application/octet-stream" });
    const fd = new FormData();
    fd.append("name", "doc");
    fd.append("file", new Blob(["hello"], { type: "text/plain" }), "h.txt");
    const up = await fetch(`${c.baseUrl}/upload`, { method: "POST", body: fd });
    assert.deepEqual(await up.json(), {
      files: [["file", "h.txt", "text/plain", "hello"]],
      fields: { name: "doc" },
    });
    assert.equal((await c.get("/stream")).text, "abc");
    assert.equal((await c.get("/arag-timeout")).status, 504);
    const u = await c.get("/arag-401");
    assert.equal(u.status, 502);
    assert.match((u.json as { detail: string }).detail, /ARAG_API_KEY/);
    const boom = await c.get("/boom");
    assert.equal(boom.status, 500);
    assert.equal((boom.json as { detail: string }).detail, "secret detail");
    const cu = await c.get("/custom");
    assert.equal(cu.status, 418);
    assert.equal((cu.json as { brew: boolean }).brew, true);
    const big = await c.request("POST", "/small", {
      body: "1234567890",
      headers: { "content-type": "application/octet-stream" },
    });
    assert.equal(big.status, 413);
  } finally {
    await c.close();
  }
});

test("production error responses hide internals", async () => {
  const app = makeApp({ NODE_ENV: "production" });
  app.get("/boom", () => {
    throw new Error("secret detail");
  });
  const c = await startTestServer(app);
  try {
    const boom = await c.get("/boom");
    assert.equal((boom.json as { detail: string }).detail, "Internal server error");
    assert.equal(boom.headers.get("strict-transport-security"), null); // no securityHeaders middleware here
  } finally {
    await c.close();
  }
});

test("middleware chain runs in order and can short-circuit", async () => {
  const app = makeApp();
  const order: string[] = [];
  app.use(async (_ctx, next) => {
    order.push("a");
    await next();
    order.push("a-after");
  });
  app.use(async (ctx, next) => {
    if (ctx.path === "/stop") {
      ctx.text(200, "stopped");
      return;
    }
    await next();
  });
  app.get("/go", () => ({ ok: true }));
  const c = await startTestServer(app);
  try {
    assert.equal((await c.get("/stop")).text, "stopped");
    assert.deepEqual((await c.get("/go")).json, { ok: true });
    assert.deepEqual(order, ["a", "a-after", "a", "a-after"]);
    assert.deepEqual(app.listRoutes()[0], {
      method: "GET",
      pattern: "/go",
      auth: "none",
      operationId: undefined,
    });
  } finally {
    await c.close();
  }
});

test("problem helpers and multipart parser edge cases", () => {
  assert.equal(notFound("Doc").status, 404);
  const v = validationError([{ path: "/a", message: "bad" }], "query");
  assert.equal(v.toProblem("/x", "r1").requestId, "r1");
  assert.equal((v.toProblem() as { in: string }).in, "query");
  assert.throws(() => parseMultipart(Buffer.from(""), "multipart/form-data"), /boundary/);
  const body = Buffer.from(
    '--B\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--B\r\nContent-Disposition: form-data; name="f"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nhi\r\n--B--\r\n',
  );
  const r = parseMultipart(body, 'multipart/form-data; boundary="B"');
  assert.deepEqual(r.fields, { a: "1" });
  assert.equal(r.files[0]?.data.toString(), "hi");
});

test("rate limiter ignores spoofed X-Forwarded-For by default and honours TRUST_PROXY modes", async () => {
  const { constantTimeEqual } = await import("../src/http/app.ts");
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("a", "ab"), false);
  const app = makeApp({ RATE_LIMIT_RPS: "1", RATE_LIMIT_BURST: "1" });
  app.get("/x", () => ({ ok: true }));
  const c = await startTestServer(app);
  try {
    assert.equal((await c.get("/x", { "x-forwarded-for": "1.1.1.1" })).status, 200);
    assert.equal(
      (await c.get("/x", { "x-forwarded-for": "2.2.2.2" })).status,
      429,
      "rotating XFF must not reset the bucket",
    );
    assert.equal(
      (await c.get("/x", { "fly-client-ip": "9.9.9.9" })).status,
      200,
      "Fly header is trusted by default",
    );
  } finally {
    await c.close();
  }
  const xff = makeApp({ RATE_LIMIT_RPS: "1", RATE_LIMIT_BURST: "1", TRUST_PROXY: "xff" });
  xff.get("/x", (ctx) => ({ ip: ctx.ip }));
  const c2 = await startTestServer(xff);
  try {
    assert.deepEqual((await c2.get("/x", { "x-forwarded-for": "5.5.5.5, 10.0.0.1" })).json, {
      ip: "5.5.5.5",
    });
  } finally {
    await c2.close();
  }
  const none = makeApp({ TRUST_PROXY: "none" });
  none.get("/x", (ctx) => ({ ip: ctx.ip }));
  const c3 = await startTestServer(none);
  try {
    assert.equal(
      (await c3.get("/x", { "fly-client-ip": "9.9.9.9" })).json &&
        ((await c3.get("/x", { "fly-client-ip": "9.9.9.9" })).json as { ip: string }).ip !== "9.9.9.9",
      true,
    );
  } finally {
    await c3.close();
  }
  assert.throws(() => makeApp({ TRUST_PROXY: "bogus" }), /TRUST_PROXY/);
});

test("securityHeaders default CSP is narrow and extensible", async () => {
  const app = makeApp();
  app.use(securityHeaders({ connectSrc: ["https://api.example.com"] }));
  app.get("/x", () => ({}));
  const c = await startTestServer(app);
  try {
    const csp = (await c.get("/x")).headers.get("content-security-policy")!;
    assert.match(csp, /connect-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/api\.example\.com/);
    assert.doesNotMatch(csp, /elevenlabs|livekit/);
    assert.match(csp, /object-src 'none'/);
  } finally {
    await c.close();
  }
});

test("per-route rate limits use their own bucket", async () => {
  const app = makeApp({ RATE_LIMIT_RPS: "100", RATE_LIMIT_BURST: "100" });
  app.get("/cheap", () => ({ ok: true }));
  app.get("/expensive", () => ({ ok: true }), { rateLimit: { rps: 1, burst: 1 } });
  const c = await startTestServer(app);
  try {
    assert.equal((await c.get("/expensive")).status, 200);
    assert.equal((await c.get("/expensive")).status, 429);
    assert.equal((await c.get("/cheap")).status, 200);
  } finally {
    await c.close();
  }
});

test("multipart parsing keeps the boundary's case and tolerates odd filenames", async () => {
  const app = makeApp();
  app.post("/up", (ctx) => ({ files: ctx.files.map((f) => f.filename), fields: ctx.body }));
  const c = await startTestServer(app);
  try {
    const boundary = "----WebKitFormBoundaryAbC123XyZ";
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a 100%.txt"\r\nContent-Type: text/plain\r\n\r\nhi\r\n--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1\r\n--${boundary}--\r\n`;
    const r = await c.request("POST", "/up", {
      body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { files: ["a 100%.txt"], fields: { n: "1" } });
  } finally {
    await c.close();
  }
});

test("static SPA fallback is opt-in and only answers navigations", async () => {
  const dir = mkdtempSync(join(tmpdir(), "spa-"));
  writeFileSync(join(dir, "index.html"), "<h1>app</h1>");
  writeFileSync(join(dir, "app.js"), "export {}");
  const assets = mkdtempSync(join(tmpdir(), "assets-"));
  writeFileSync(join(assets, "kit.css"), "body{}");

  // Default (no fallback): a deep link 404s, which is what an asset mount wants.
  const plain = makeApp();
  plain.static("/", dir);
  const p = await startTestServer(plain);
  try {
    assert.equal((await p.get("/documents/abc", { accept: "text/html" })).status, 404);
  } finally {
    await p.close();
  }

  const app = makeApp();
  app.get("/api/v1/ping", () => ({ ok: true }));
  app.static("/ui", assets); // no fallback: a missing asset must stay a 404
  app.static("/", dir, { fallback: true });
  const c = await startTestServer(app);
  try {
    const html = { accept: "text/html,application/xhtml+xml" };
    assert.equal((await c.get("/")).status, 200, "real index still served");
    assert.equal((await c.get("/app.js")).status, 200, "real asset still served");
    // A navigation with no matching file gets the SPA document…
    const deep = await c.get("/documents/abc-123", html);
    assert.equal(deep.status, 200);
    assert.match(deep.headers.get("content-type")!, /text\/html/);
    assert.match(deep.text, /<h1>app<\/h1>/);
    // …but a missing asset, a non-HTML client and an unknown API path do not.
    assert.equal((await c.get("/vendor/missing.js", html)).status, 404, "extension ⇒ no fallback");
    assert.equal((await c.get("/documents/abc", { accept: "application/json" })).status, 404);
    assert.equal((await c.get("/ui/missing", html)).status, 404, "mount without fallback");
    assert.equal((await c.request("POST", "/documents/abc", { headers: html })).status, 404);
    // Registered routes always win over the fallback.
    assert.deepEqual((await c.get("/api/v1/ping", html)).json, { ok: true });
  } finally {
    await c.close();
  }
});

test('body:"auto" hands the multipart parser the original Content-Type, case intact', async () => {
  const app = makeApp();
  // Explicitly "auto" — the mode that used to lowercase the header before handing it on, which
  // turned a ----WebKitFormBoundary… upload into zero parts (fixed in 0.1.5; regression-locked here).
  app.post("/auto", (ctx) => ({ files: ctx.files.map((f) => f.filename), fields: ctx.body }), {
    body: "auto",
  });
  const c = await startTestServer(app);
  try {
    const boundary = "----WebKitFormBoundaryXyZ987AbC";
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="Report Q3.PDF"\r\nContent-Type: application/pdf\r\n\r\n%PDF\r\n--${boundary}\r\nContent-Disposition: form-data; name="Kind"\r\n\r\nInvoice\r\n--${boundary}--\r\n`;
    for (const mediaType of ["multipart/form-data", "Multipart/Form-Data", "MULTIPART/FORM-DATA"]) {
      const r = await c.request("POST", "/auto", {
        body,
        headers: { "content-type": `${mediaType}; BOUNDARY=${boundary}` },
      });
      assert.equal(r.status, 200, mediaType);
      assert.deepEqual(r.json, { files: ["Report Q3.PDF"], fields: { Kind: "Invoice" } }, mediaType);
    }
  } finally {
    await c.close();
  }
});
