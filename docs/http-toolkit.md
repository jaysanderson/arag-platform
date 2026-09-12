# HTTP toolkit, config, logging, store and jobs

## App

```ts
const app = new App({ env, log });
app.use(securityHeaders(), cors());
healthRoutes(app, async () => ({ arag: await arag.health() }));
app.docs("/api/v1", openapi);                 // openapi.json, /docs (Redoc), /swagger
app.get("/api/v1/items/:id", handler, { auth: "api", validate: operationSchemas(openapi, "/api/v1/items/{id}", "get"), operationId: "getItem" });
app.post("/api/v1/items", handler, { auth: "api", validate: { body: { $ref: "#/components/schemas/ItemCreate" } } });
app.get("/api/v1/admin/logs", (ctx) => ({ items: log.recent(ctx.queryObj) }), { auth: "admin" });
app.static("/admin", "./admin"); app.static("/", "./public");
await app.listen();
```

Handler contract: return a JSON value (200), or write with `ctx.json(status, body)`, `ctx.text`, `ctx.html`, `ctx.redirect`, `ctx.noContent`, `ctx.stream(status, headers, webStream)`, `ctx.sse()`. Throw `HttpError` (or helpers `badRequest`, `notFound`, …) for problem responses. `ctx.params`, `ctx.queryObj` (validated/coerced), `ctx.body` (JSON or multipart fields), `ctx.files` (multipart), `ctx.rawBody`, `ctx.auth`, `ctx.log`, `ctx.requestId`, `ctx.ip`, `ctx.cookies()`, `ctx.setCookie()`.

Route options: `auth: none|api|admin`, `validate: {body, query, params, headers}` (schemas may `$ref` the registered OpenAPI doc), `body: auto|json|multipart|raw|none`, `bodyLimit`, `noRateLimit`, `operationId`.

Pipeline per request: request id → middleware chain → authenticate → route match (404/405) → auth enforcement → rate limit (admin exempt) → body parse (limits) → validation → handler → problem rendering → access log.

Sessions: `app.issueSession(ttl)` / `app.verifySession(token)` (HMAC, secret = `ADMIN_TOKEN` or per-boot random). Error mapping: `app.errorMapper = (err) => HttpError | null` for product-specific errors; `AragError` is mapped by default (timeout → 504, 401 → 502 with hint, 404 → 404, other → 502).

## Config (`readEnv`, `loadDotEnv`, `assertAragEnv`, `describeEnv`)
See STANDARDS §6. `readEnv(process.env)` is pure and validated; `describeEnv()` is what admin config pages show.

## Logger
`log.info(msg, fields)` etc. → JSON lines; `log.child({requestId})`; `log.recent({level, contains, limit})` for admin inspection; secret-looking keys are redacted.

## Store and jobs
`new Store(env.dataDir)` → `store.collection<T>("name", {cap})` with `put/get/update/delete/list/flush`; atomic file writes, corrupt files are quarantined. `new JobManager(store, log, {concurrency})` → `register(kind, runner)`, `submit(kind, input)` → Job, `run()` (await), `cancel(id)`, `subscribe(id, fn)` (drive SSE), `list({kind,status,ref})`. Runners get `ctx.stage(name, message, fn, {soft, progress})`, `ctx.emit(...)`, `ctx.signal`, `ctx.check()`.

SSE from a job:
```ts
app.get("/api/v1/jobs/:id/events", (ctx) => {
  const sse = ctx.sse();
  const unsub = jobs.subscribe(ctx.params.id!, (e) => sse.send(e.stage === "job" ? "job" : "event", e));
  sse.onClose(unsub);
});
```
