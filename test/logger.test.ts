import assert from "node:assert/strict";
import { test } from "node:test";
import { Logger, redact } from "../src/log/logger.ts";

test("logger filters by level, writes JSON lines and keeps a ring buffer", () => {
  const lines: string[] = [];
  const log = new Logger({ level: "info", ringSize: 3, write: (l) => lines.push(l) });
  log.debug("nope");
  log.info("one", { a: 1 });
  log.warn("two");
  log.error("three", { token: "secret" });
  log.info("four");
  assert.equal(lines.length, 4);
  assert.equal(JSON.parse(lines[0]!).msg, "one");
  assert.equal(JSON.parse(lines[2]!).token, "•••");
  assert.equal(log.ring.length, 3);
  assert.deepEqual(
    log.recent({ level: "warn" }).map((r) => r.msg),
    ["two", "three"],
  );
  assert.equal(log.recent({ contains: "four" }).length, 1);
});

test("child loggers share the ring and add base fields", () => {
  const lines: string[] = [];
  const log = new Logger({ level: "debug", write: (l) => lines.push(l) });
  const child = log.child({ requestId: "r1" });
  child.info("hi");
  assert.equal(JSON.parse(lines[0]!).requestId, "r1");
  assert.equal(log.ring.length, 1);
});

test("redact walks nested objects and arrays", () => {
  const out = redact({
    a: { apiKey: "x", list: [{ password: "p", ok: 1 }] },
    authorization: "Bearer z",
    n: 2,
  }) as Record<string, unknown>;
  assert.deepEqual(out, {
    a: { apiKey: "•••", list: [{ password: "•••", ok: 1 }] },
    authorization: "•••",
    n: 2,
  });
});
