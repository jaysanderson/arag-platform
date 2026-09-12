# Mock ARAG server

`src/arag/mock/server.ts` implements the ARAG subset the products use, in-process, with deterministic fixtures. Products run against it with `ARAG_MOCK=1`; tests and the showcase recordings depend on it.

```ts
const mock = await startMockArag({ seed: [{ title: "invoice.txt", text: SAMPLE_DOCS.invoice }], processingMs: 0, streamDelayMs: 0 });
// mock.url = http://127.0.0.1:<port>/api/v1, mock.kbId, mock.apiKey
await mock.close();
```

Standalone: `make mock` (or `MOCK_SEED=docs|calls MOCK_PORT=8790 node src/arag/mock/cli.ts`).

## Supported endpoints

`POST /upload` (text is used verbatim; images/PDFs map to a fixture by filename hint: invoice, purchase-order, preauth-form, remittance-statement, contract, resume, receipt, bank-statement), `POST /resources`, `POST /resource/{rid}/file/{field}/upload` (audio/video → transcript paragraphs with `start_seconds`), `GET/DELETE /resource/{rid}` (`show`, `extracted` honoured), `GET …/download/field` (Range → 206), `POST /find`, `POST /catalog` (paginated), `POST /ask` and `POST /resource/{rid}/ask` (NDJSON: retrieval → answer chunks or `answer_json` → citations → metadata → status), `search_configurations` CRUD (used by `/ask` via `search_configuration`), `labelsets`, `tasks` (labeler and ask operations are applied immediately to every resource; one running task per operation type enforced), `POST /predict/remi`, `GET /configuration`, `GET /schema`.

## Determinism

- Retrieval scores paragraphs by query-term overlap (stop words removed); generated `da-*` fields are excluded from retrieval.
- Text answers quote the best paragraph (two sentences) or a short summary when the query contains "summar"; with no hit the answer is "Not enough data to answer this." — or `HANDOFF: not in the knowledge base.` if the system prompt mentions `HANDOFF:`.
- `answer_json_schema` is filled by heuristics keyed on property names (invoice numbers, totals, dates, parties, entities, call analysis/metrics, live brief). Values come from the resource text, so demos show real-looking data.
- `answerHook` lets a test override answers for a specific request.
- `mock.calls` records every request for assertions; `mock.mock.resources` exposes state.

Options: `kbId`, `apiKey` (401 on mismatch), `processingMs` (PENDING duration), `searchableLagMs`, `streamDelayMs`, `seed`, `generativeModel`, `answerHook`, `log`.
