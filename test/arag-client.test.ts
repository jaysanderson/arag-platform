import assert from "node:assert/strict";
import { test } from "node:test";
import { AragClient, resolveBaseUrl, withRetry } from "../src/arag/client.ts";
import { AragError } from "../src/arag/errors.ts";
import { SAMPLE_CALL_TRANSCRIPT, SAMPLE_DOCS } from "../src/arag/mock/fixtures.ts";
import { startMockArag } from "../src/arag/mock/server.ts";

test("resolveBaseUrl and constructor guards", () => {
  assert.equal(resolveBaseUrl({ region: "europe-1" }), "https://europe-1.dp.progress.cloud/api/v1");
  assert.equal(resolveBaseUrl({ baseUrl: "http://x/api/v1/" }), "http://x/api/v1");
  assert.throws(() => resolveBaseUrl({}), /baseUrl or region/);
  assert.throws(() => new AragClient({ kbId: "", apiKey: "" }), /kbId/);
});

test("AragError retryable semantics", () => {
  assert.ok(new AragError("x", "timeout", "op").retryable);
  assert.ok(new AragError("x", "http", "op", 503).retryable);
  assert.ok(!new AragError("x", "http", "op", 400).retryable);
  assert.equal(new AragError("x", "network", "op").toJSON().kind, "network");
});

test("client end-to-end against the mock: upload, wait, text, find, ask, delete", async () => {
  const mock = await startMockArag({ processingMs: 30, searchableLagMs: 30 });
  const seen: string[] = [];
  const client = new AragClient({
    kbId: mock.kbId,
    apiKey: mock.apiKey,
    baseUrl: mock.url,
    onRequest: (i) => seen.push(`${i.method} ${i.path.split("?")[0]} ${i.status}`),
  });
  try {
    const up = await client.upload(Buffer.from(SAMPLE_DOCS.invoice!), "invoice.txt", "text/plain");
    assert.ok(up.uuid);
    assert.equal(await client.status(up.uuid), "PENDING");
    const st = await client.waitProcessed(up.uuid, { intervalMs: 10, timeoutMs: 2000 });
    assert.equal(st, "PROCESSED");
    assert.equal(await client.waitSearchable(up.uuid, { intervalMs: 10, timeoutMs: 2000 }), true);
    const text = await client.extractedText(up.uuid);
    assert.match(text, /ACME ROBOTICS/);
    const found = await client.find({ query: "invoice total", resource_filters: [up.uuid] });
    assert.ok(found.resources?.[up.uuid]);
    const ids = await client.listResourceIds();
    assert.deepEqual(ids, [up.uuid]);

    const res = await client.ask({
      query: "What is the total due?",
      resource_filters: [up.uuid],
      citations: true,
    });
    assert.match(res.answerText, /\$110,000\.00|TOTAL DUE/);
    assert.ok(Object.keys(res.citations).length >= 1);
    assert.deepEqual(res.sourceTitles, ["invoice.txt"]);
    assert.equal(res.status, "success");
    assert.ok(res.timings.totalMs >= 0 && res.timings.firstTokenMs > 0);

    const json = await client.ask({
      query: "ACME ROBOTICS invoice",
      resource_filters: [up.uuid],
      citations: true, // dropped automatically
      rag_strategies: [{ name: "full_resource" }],
      answer_json_schema: {
        name: "invoice_extraction",
        parameters: {
          type: "object",
          properties: {
            vendor_name: { type: "string" },
            invoice_number: { type: "string" },
            total: { type: "string" },
            currency: { type: "string" },
            line_items: { type: "array", items: { type: "string" } },
          },
        },
      },
    });
    const obj = json.answerJson as Record<string, unknown>;
    assert.equal(obj.vendor_name, "ACME ROBOTICS PTY LTD");
    assert.equal(obj.invoice_number, "INV-2026-0042");
    assert.equal(obj.total, "$110,000.00");
    assert.equal(obj.currency, "AUD");
    assert.ok(Array.isArray(obj.line_items) && (obj.line_items as string[]).length >= 2);

    const health = await client.health();
    assert.equal(health.ok, true);
    assert.equal(health.generativeModel, "chatgpt-azure-4o");
    await client.deleteResource(up.uuid);
    await assert.rejects(client.getResource(up.uuid), (e: AragError) => e.status === 404);
    assert.ok(seen.some((s) => s.startsWith("POST /upload 201")));
  } finally {
    await mock.close();
  }
});

test("client: resources, file fields, download with Range, labelsets, tasks, search configs, remi, models", async () => {
  const mock = await startMockArag();
  const client = new AragClient({ kbId: mock.kbId, apiKey: mock.apiKey, baseUrl: mock.url });
  try {
    const { uuid } = await client.createResource({
      title: "Call 1",
      icon: "audio/mpeg",
      extra: { metadata: { agent_name: "Maria" } },
    });
    await client.uploadFileField(uuid, "media", Buffer.alloc(1000, 7), "call.mp3", "audio/mpeg");
    const r = await client.getResource(uuid, {
      show: ["basic", "values", "extracted", "extra"],
      extracted: ["text", "metadata"],
    });
    const media = r.data?.files?.media;
    assert.ok(media?.extracted?.metadata?.metadata?.paragraphs?.length);
    assert.equal(media?.extracted?.metadata?.metadata?.paragraphs?.[0]?.kind, "TRANSCRIPT");
    assert.deepEqual(media?.extracted?.metadata?.metadata?.paragraphs?.[1]?.start_seconds, [6]);
    assert.equal(r.extra?.metadata?.agent_name, "Maria");
    const dl = await client.downloadFileField(uuid, "media", { range: "bytes=0-99" });
    assert.equal(dl.status, 206);
    assert.equal(dl.headers.get("content-range"), "bytes 0-99/1000");
    assert.equal((await dl.arrayBuffer()).byteLength, 100);

    await client.putLabelset("sentiment", {
      title: "Sentiment",
      kind: ["RESOURCES"],
      labels: [{ title: "Positive" }, { title: "Negative" }],
    });
    assert.ok((await client.listLabelsets()).labelsets.sentiment);
    const task = await client.startTask({
      name: "labeler",
      parameters: {
        name: "resource-labeler",
        on: 1,
        llm: { model: "chatgpt-azure-4o", provider: "openai" },
        operations: [
          {
            label: {
              ident: "sentiment",
              multiple: false,
              labels: [
                { label: "Positive", description: "satisfied grateful" },
                { label: "Negative", description: "upset frustrated overdrawn" },
              ],
            },
          },
        ],
      },
    });
    assert.ok(task.id);
    assert.equal(await client.waitTasksIdle({ graceMs: 0, intervalMs: 5 }), true);
    const labelled = await client.getResource(uuid, { show: ["basic"] });
    assert.deepEqual(labelled.computedmetadata?.field_classifications?.[0]?.classifications, [
      { labelset: "sentiment", label: "Negative" },
    ]);
    await assert.rejects(
      client.startTask({ name: "ask", parameters: { operations: [{ ask: { destination: "x" } }] } }),
      /422/,
    );
    const gen = await client.startTask({
      name: "ask",
      parameters: {
        on: 1,
        llm: { model: "m" },
        operations: [{ ask: { destination: "call_metrics", question: "metrics", json: false } }],
      },
    });
    assert.ok(gen.id);
    const withDa = await client.getResource(uuid, { show: ["values"] });
    const da = Object.keys(withDa.data?.texts ?? {}).find((k) => k.startsWith("da-call_metrics-f-media"));
    assert.ok(da);
    await client.deleteTask(task.id);
    await client.deleteTask("missing");

    await client.putSearchConfiguration("cfg", {
      kind: "ask",
      config: {
        generative_model: "chatgpt-azure-4o",
        answer_json_schema: {
          name: "s",
          parameters: { type: "object", properties: { summary: { type: "string" } } },
        },
      },
    });
    await client.putSearchConfiguration("cfg", { kind: "ask", config: { generative_model: "x" } }); // replace
    assert.ok((await client.listSearchConfigurations()).cfg);
    assert.equal((await client.getSearchConfiguration("cfg")).config.generative_model, "x");
    await client.deleteSearchConfiguration("cfg");
    await client.deleteSearchConfiguration("cfg"); // 404 tolerated
    await client.deleteLabelset("sentiment");

    const remi = await client.remi({ user_id: "t", question: "q", answer: "a", contexts: ["c1", "c2"] });
    assert.equal(remi.answer_relevance?.score, 4);
    const schema = await client.getSchema();
    assert.ok((schema.properties as Record<string, unknown>).generative_model);
  } finally {
    await mock.close();
  }
});

test("client maps auth failures, timeouts, aborts and stored-config asks", async () => {
  const mock = await startMockArag({
    seed: [
      {
        title: "kb-doc",
        text: "Binder jetting prints metal parts layer by layer. PureSinter furnaces sinter stainless steel.",
      },
    ],
  });
  try {
    const bad = new AragClient({ kbId: mock.kbId, apiKey: "wrong", baseUrl: mock.url });
    await assert.rejects(bad.catalog(), (e: AragError) => e.kind === "http" && e.status === 401);
    const slow = new AragClient({
      kbId: mock.kbId,
      apiKey: mock.apiKey,
      baseUrl: mock.url,
      timeoutMs: 1,
      fetch: (_u, init) =>
        new Promise((r, j) => {
          const t = setTimeout(() => r(new Response("{}")), 50);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            j(new Error("aborted"));
          });
        }),
    });
    await assert.rejects(slow.catalog(), (e: AragError) => e.kind === "timeout");
    const ctl = new AbortController();
    ctl.abort();
    const client = new AragClient({ kbId: mock.kbId, apiKey: mock.apiKey, baseUrl: mock.url });
    await assert.rejects(client.catalog({}, { signal: ctl.signal }), (e: AragError) => e.kind === "aborted");
    const net = new AragClient({ kbId: "k", apiKey: "a", baseUrl: "http://127.0.0.1:1" });
    await assert.rejects(net.catalog(), (e: AragError) => e.kind === "network");
    await assert.rejects(
      client.ask({ query: "x", search_configuration: "missing" }),
      (e: AragError) => e.status === 404,
    );
    await client.putSearchConfiguration("voice", {
      kind: "ask",
      config: { prompt: { system: "Reply HANDOFF: when unknown" }, citations: true },
    });
    const known = await client.ask({ query: "binder jetting metal parts", search_configuration: "voice" });
    assert.match(known.answerText, /Binder jetting/);
    const unknown = await client.ask({ query: "capital of france", search_configuration: "voice" });
    assert.match(unknown.answerText, /HANDOFF:/);
    const perResource = await client.ask(
      { query: "binder jetting" },
      { resourceId: [...mock.mock.resources.keys()][0] },
    );
    assert.ok(perResource.answerText.length > 0);
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new AragError("x", "network", "op");
        return "ok";
      },
      { baseMs: 1 },
    );
    assert.equal(out, "ok");
    await assert.rejects(
      withRetry(
        async () => {
          throw new AragError("nope", "http", "op", 400);
        },
        { baseMs: 1 },
      ),
      /nope/,
    );
  } finally {
    await mock.close();
  }
});

test("mock transcript seeds produce timestamped paragraphs and DA fixtures", async () => {
  const mock = await startMockArag({
    seed: [
      { title: "call", filename: "c.mp3", contentType: "audio/mpeg", transcript: SAMPLE_CALL_TRANSCRIPT },
    ],
  });
  const client = new AragClient({ kbId: mock.kbId, apiKey: mock.apiKey, baseUrl: mock.url });
  try {
    const id = [...mock.mock.resources.keys()][0]!;
    await client.startTask({
      name: "ask",
      parameters: {
        on: 1,
        llm: { model: "m" },
        operations: [
          { ask: { destination: "call_analysis", question: "analyse", json: false } },
          { ask: { destination: "call_metrics", question: "metrics", json: false } },
        ],
      },
    });
    const r = await client.getResource(id, {
      show: ["values", "extracted"],
      extracted: ["text", "metadata"],
    });
    const body = r.data?.texts?.["da-call_analysis-f-media"]?.value?.body ?? "";
    assert.match(body, /```json/);
    assert.match(body, /executive_summary/);
    const ask = await client.ask({
      query: "Was the member satisfied?",
      resource_filters: [id],
      citations: true,
    });
    assert.ok(Object.keys(ask.citations)[0]?.startsWith(`${id}/f/media/`));
  } finally {
    await mock.close();
  }
});
