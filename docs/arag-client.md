# AragClient

`src/arag/client.ts` — a typed, zero-dependency client for the Progress Agentic RAG REST API (one instance = one Knowledge Box).

```ts
import { AragClient, AragError, withRetry } from "../vendor/arag-platform/src/index.ts";
const arag = new AragClient({ kbId, apiKey, region: "aws-us-east-2-1" /* or baseUrl */, timeoutMs: 60_000 });
```

| Area | Methods | ARAG endpoint |
|---|---|---|
| Ingest | `upload(bytes, filename, contentType, {extractStrategy})`, `createResource(body)`, `uploadFileField(rid, field, bytes, filename, ct)` | `POST /upload`, `POST /resources`, `POST /resource/{rid}/file/{field}/upload` |
| Read | `getResource(rid, {show, extracted})`, `status(rid)`, `extractedText(rid)`, `downloadFileField(rid, field, {range})`, `deleteResource(rid)` | `GET/DELETE /resource/{rid}`, `…/download/field` |
| Readiness | `waitProcessed(rid)`, `isSearchable(rid)`, `waitSearchable(rid)` | polling `GET /resource`, `POST /find` |
| Search | `find(body)`, `catalog(body)`, `listResourceIds()` | `POST /find`, `POST /catalog` |
| Generate | `ask(body, {resourceId, onItem})` → `AskResult`, `askStream(body)` → async iterator of `AskStreamItem` | `POST /ask`, `POST /resource/{rid}/ask` (NDJSON) |
| Config | `putSearchConfiguration(name, {kind, config})`, `getSearchConfiguration`, `listSearchConfigurations`, `deleteSearchConfiguration`, `getConfiguration()`, `getSchema()` | `/search_configurations`, `/configuration`, `/schema` |
| Labels | `listLabelsets()`, `putLabelset(id, body)`, `deleteLabelset(id)` | `/labelsets`, `/labelset/{id}` |
| Data augmentation | `listTasks()`, `startTask({name, parameters})`, `deleteTask(id)`, `waitTasksIdle()` | `/tasks`, `/task/start`, `/task/{id}` |
| Quality | `remi({question, answer, contexts})` | `POST /predict/remi` |
| Ops | `health()` | catalog + configuration |

## Behaviours worth knowing (verified against the live platform and the official docs)

- `answer_json_schema` and `citations` are mutually exclusive on ARAG (422). `askStream()` drops `citations` automatically when a schema is set; the structured object arrives as `answerJson`.
- A resource's status turns `PROCESSED` a few seconds **before** it is retrievable. Gate extraction on `waitSearchable(rid, { query: <first words of the extracted text> })` after `waitProcessed()`; without a document-derived probe query the check can report `false` on short texts even though retrieval works.
- Stream item order is not fixed: on the current platform `answer` chunks can arrive **before** `retrieval`, followed by `status`, `augmented_context`, `citations`, `metadata`, `consumption`. `ask()` assembles regardless of order.
- Scope single-document questions with `resource_filters: [rid]` on the KB `/ask`; the per-resource `/resource/{rid}/ask` endpoint 500/503s with `full_resource` and returns no retrieval on some KBs (found live by the Document Processing team).
- `POST /predict/remi` is best-effort: it can return HTTP 500 for some inputs (observed live with a single short context). Treat REMi as an optional quality signal, never block an answer on it.
- With `rag_strategies: [{ name: "full_resource" }]`, retrieval still runs first to locate the resource. Seed `query` with real document text (not an instruction) so retrieval hits.
- Data-augmentation tasks require an `llm` block and allow one running task per operation type; use `waitTasksIdle()` between starts.
- Errors are `AragError` with `kind` (`timeout | http | network | aborted | protocol`), `status`, `operation`, `detail`, and `retryable`. The HTTP toolkit maps them to 502/504 problems without leaking upstream bodies.
- `withRetry(fn, {attempts, baseMs})` retries only retryable errors (network, timeout, 429, 5xx) — use for reads, not for uploads.
- Every method accepts `{ signal }` for cancellation (barge-in, client disconnect).

## Testing

`startMockArag()` gives a full in-process KB; construct the client with `baseUrl: mock.url, kbId: mock.kbId, apiKey: mock.apiKey`. See `test/arag-client.test.ts` for end-to-end examples of every method.
