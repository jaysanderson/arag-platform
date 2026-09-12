import assert from "node:assert/strict";
import { test } from "node:test";
import { iterateAskStream, NdjsonSplitter, normaliseItem, toNdjsonLine } from "../src/arag/ndjson.ts";

test("normaliseItem accepts current envelope and legacy shapes", () => {
  assert.deepEqual(normaliseItem({ item: { type: "answer", text: "hi" } }), { type: "answer", text: "hi" });
  assert.deepEqual(normaliseItem({ answer: "legacy" }), { type: "answer", text: "legacy" });
  assert.deepEqual(normaliseItem({ item: { type: "answer_json", object: { a: 1 } } }), {
    type: "answer_json",
    object: { a: 1 },
  });
  assert.deepEqual(normaliseItem({ answer: "", answer_json: { b: 2 } }), {
    type: "answer_json",
    object: { b: 2 },
  });
  const r = normaliseItem({ item: { type: "retrieval", results: { resources: { x: { title: "T" } } } } });
  assert.equal(r?.type, "retrieval");
  assert.equal(normaliseItem(null), null);
  assert.equal(normaliseItem(5), null);
  assert.equal(normaliseItem({}), null);
  assert.equal(normaliseItem({ item: { type: "status", code: "0" } })?.type, "status");
});

test("NdjsonSplitter handles chunk boundaries, blank and malformed lines", () => {
  const s = new NdjsonSplitter();
  const enc = new TextEncoder();
  const a = s.push(enc.encode('{"a":1}\n{"b":'));
  assert.deepEqual(a, [{ a: 1 }]);
  const b = s.push(enc.encode("2}\n\nnot json\n"));
  assert.deepEqual(b, [{ b: 2 }]);
  assert.equal(s.malformed.length, 1);
  s.push(enc.encode('{"c":3}'));
  assert.deepEqual(s.flush(), [{ c: 3 }]);
});

test("iterateAskStream yields normalised items from a ReadableStream", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      c.enqueue(enc.encode(toNdjsonLine({ type: "retrieval", results: { resources: {} } })));
      c.enqueue(enc.encode(toNdjsonLine({ type: "answer", text: "Hello" })));
      c.enqueue(enc.encode(toNdjsonLine({ type: "status", code: "0" })));
      c.close();
    },
  });
  const items = [];
  for await (const it of iterateAskStream(body)) items.push(it.type);
  assert.deepEqual(items, ["retrieval", "answer", "status"]);
});
