/** Integration + contract tests: boot the product in-process against the mock ARAG. */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { openapi } from "../src/openapi.ts";
import { createProduct, type Product } from "../src/server.ts";
import { Logger, readEnv, testing } from "../vendor/arag-platform/src/index.ts";

const ADMIN = "test-admin-token";
let product: Product;
let c: testing.TestClient;

before(async () => {
  const env = readEnv({
    ARAG_MOCK: "1",
    ADMIN_TOKEN: ADMIN,
    DATA_DIR: mkdtempSync(join(tmpdir(), "tpl-")),
    RATE_LIMIT_RPS: "0",
    NODE_ENV: "test",
  });
  product = await createProduct(env, { log: new Logger({ level: "error", write: () => undefined }) });
  c = await testing.startTestServer(product.app);
});
after(async () => {
  await c.close();
  await product.close();
});

test("spec is lint-clean and every /api/v1 route is documented", () => {
  assert.deepEqual(testing.lintSpec(openapi), []);
  assert.deepEqual(testing.missingFromSpec(product.app, openapi), []);
});

test("create → job → processed → list/get → ask → delete (responses match the spec)", async () => {
  const created = await c.post("/api/v1/notes", {
    title: "Onboarding",
    body: "New employees receive a laptop on day one. Expense claims must be filed within 30 days.",
  });
  assert.equal(created.status, 202);
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/notes", "post", 202, created.json), []);
  const { note, job } = created.json as { note: { id: string }; job: { id: string } };
  const done = await product.jobs.run("ingest-note", { noteId: note.id }); // second run just re-verifies; first completes via queue
  assert.equal(done.status, "succeeded");
  await new Promise((r) => setTimeout(r, 50));
  const got = await c.get(`/api/v1/notes/${note.id}`);
  assert.equal(got.status, 200);
  assert.equal((got.json as { status: string }).status, "PROCESSED");
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/notes/{id}", "get", 200, got.json), []);
  const list = await c.get("/api/v1/notes?page=1&page_size=10");
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/notes", "get", 200, list.json), []);
  assert.equal((list.json as { total: number }).total, 1);
  // The list view's filters are server-side, and `total` is the size of the FILTERED set.
  const totalFor = async (query: string) =>
    ((await c.get(`/api/v1/notes?${query}`)).json as { total: number }).total;
  assert.equal(await totalFor("q=onboard"), 1);
  assert.equal(await totalFor("q=nothing-like-this"), 0);
  assert.equal(await totalFor("status=PROCESSED"), 1);
  assert.equal(await totalFor("status=ERROR"), 0);
  assert.equal((await c.get("/api/v1/notes?sort=title:asc")).status, 200);
  assert.equal((await c.get("/api/v1/notes?sort=bogus")).status, 400, "sort is validated");
  // The detail page reads the note's job by ref.
  const byRef = await c.get(`/api/v1/jobs?ref=${note.id}`);
  assert.equal((byRef.json as { items: unknown[] }).items.length, 1);
  const j = await c.get(`/api/v1/jobs/${job.id}`);
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/jobs/{id}", "get", 200, j.json), []);
  const ev = await c.get(`/api/v1/jobs/${job.id}/events`);
  assert.match(ev.text, /event: job/);
  const ask = await c.post("/api/v1/ask", { question: "When must expense claims be filed?" });
  assert.equal(ask.status, 200);
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/ask", "post", 200, ask.json), []);
  assert.match((ask.json as { answer: string }).answer, /30 days/);
  assert.equal((await c.request("DELETE", `/api/v1/notes/${note.id}`)).status, 204);
  assert.equal((await c.get(`/api/v1/notes/${note.id}`)).status, 404);
});

test("bulk delete reports what actually went", async () => {
  const ids: string[] = [];
  for (const title of ["Bulk A", "Bulk B"]) {
    const r = await c.post("/api/v1/notes", { title, body: "Something to index." });
    ids.push((r.json as { note: { id: string } }).note.id);
  }
  const res = await c.post("/api/v1/notes/bulk-delete", { ids: [...ids, "not-a-real-id"] });
  assert.equal(res.status, 200);
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/notes/bulk-delete", "post", 200, res.json), []);
  assert.deepEqual(res.json, { deleted: 2, missing: 1 });
  assert.equal(
    (await c.post("/api/v1/notes/bulk-delete", { ids: [] })).status,
    400,
    "an empty list is a 400",
  );
});

test("validation and problem details", async () => {
  const bad = await c.post("/api/v1/notes", { title: "" });
  assert.equal(bad.status, 400);
  assert.equal((bad.json as { type: string }).type, "https://arag.dev/problems/validation");
  assert.equal((await c.get("/api/v1/notes?page=0")).status, 400);
});

test("admin routes require the token; login sets a cookie", async () => {
  assert.equal((await c.get("/api/v1/admin/health")).status, 401);
  const h = await c.get("/api/v1/admin/health", { authorization: `Bearer ${ADMIN}` });
  assert.equal(h.status, 200);
  assert.deepEqual(testing.checkResponse(openapi, "/api/v1/admin/health", "get", 200, h.json), []);
  const login = await c.post("/api/v1/admin/login", { token: ADMIN });
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  assert.equal((await c.get("/api/v1/admin/config", { cookie })).status, 200);
  assert.equal((await c.get("/api/v1/admin/usage", { cookie })).status, 200);
  assert.equal((await c.get("/api/v1/admin/logs?level=info", { cookie })).status, 200);
  assert.equal((await c.post("/api/v1/admin/login", { token: "wrong" })).status, 401);
});

test("docs, health and static surfaces are served", async () => {
  assert.equal((await c.get("/api/v1/openapi.json")).status, 200);
  assert.equal((await c.get("/healthz")).status, 200);
  const ready = await c.get("/readyz");
  assert.equal((ready.json as { arag: { ok: boolean } }).arag.ok, true);
  assert.match((await c.get("/")).text, /arag-app-shell/);
  assert.match((await c.get("/admin/")).text, /Operator sign-in/);
  assert.match((await c.get("/ui/arag-ui.css")).headers.get("content-type")!, /text\/css/);
  assert.match(
    (await c.get("/ui/brand/arag-logo-alt.svg")).text,
    /5ce500/,
    "the wordmark ships with the kit",
  );
  // Deep links reach the single-document UI (app.static(..., { fallback: true })), but a missing
  // asset still 404s and the API is untouched by the fallback.
  const html = { accept: "text/html" };
  assert.match((await c.get("/notes/anything", html)).text, /arag-app-shell/);
  assert.match((await c.get("/settings", html)).text, /arag-app-shell/);
  assert.equal((await c.get("/missing.js", html)).status, 404);
  assert.equal((await c.get("/api/v1/notes/definitely-missing")).status, 404);
});
