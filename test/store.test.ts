import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Logger } from "../src/log/logger.ts";
import { JobManager } from "../src/store/jobs.ts";
import { Store } from "../src/store/jsonstore.ts";

interface Doc {
  id: string;
  createdAt: string;
  updatedAt: string;
  v: number;
}

test("collection put/get/update/delete/list with cap and persistence", () => {
  const dir = mkdtempSync(join(tmpdir(), "store-"));
  const store = new Store(dir);
  const col = store.collection<Doc>("things", { cap: 2 });
  col.put({ id: "a", v: 1 });
  col.put({ id: "b", v: 2 });
  col.update("a", { v: 10 });
  assert.equal(col.get("a")?.v, 10);
  col.put({ id: "c", v: 3 });
  assert.equal(col.size, 2);
  assert.equal(col.has("a"), false, "oldest evicted");
  assert.deepEqual(
    col.list({ sort: (x, y) => x.v - y.v }).map((d) => d.v),
    [2, 3],
  );
  col.flush();
  assert.ok(existsSync(join(dir, "things.json")));
  const again = new Store(dir).collection<Doc>("things");
  assert.equal(again.size, 2);
  assert.ok(again.delete("b"));
  again.flush();
  assert.equal(JSON.parse(readFileSync(join(dir, "things.json"), "utf8")).length, 1);
  assert.equal(store.stats().things?.count, 2);
});

test("memory-only store never touches disk", () => {
  const dir = join(tmpdir(), `nope-${Date.now()}`);
  const store = new Store(dir, { persist: false });
  store.collection<Doc>("x").put({ id: "1", v: 1 });
  store.flushAll();
  assert.equal(existsSync(dir), false);
});

test("job manager runs, emits stage events, persists and cancels", async () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "jobs-")));
  const log = new Logger({ level: "error", write: () => undefined });
  const jobs = new JobManager(store, log, { concurrency: 1 });
  jobs.register<{ n: number }, number>("double", async (ctx) => {
    const a = await ctx.stage("first", "doing", async () => ctx.job.input.n * 2, { progress: 0.5 });
    await ctx.stage(
      "soft",
      "may fail",
      async () => {
        throw new Error("ignored");
      },
      { soft: true },
    );
    ctx.emit("note", "progress", { message: "half way" });
    return a!;
  });
  const done = await jobs.run<{ n: number }, number>("double", { n: 21 }, { ref: "doc-1" });
  assert.equal(done.status, "succeeded");
  assert.equal(done.result, 42);
  assert.equal(done.progress, 1);
  assert.ok(done.events.some((e) => e.stage === "soft" && e.status === "error"));
  assert.ok((done.durationsMs.first ?? -1) >= 0);
  assert.equal(jobs.list({ ref: "doc-1" }).length, 1);

  jobs.register("fail", async () => {
    throw new Error("boom");
  });
  const failed = await jobs.run("fail", {});
  assert.equal(failed.status, "failed");
  assert.equal(failed.error?.message, "boom");

  jobs.register("slow", async (ctx) => {
    await new Promise((r) => setTimeout(r, 200));
    ctx.check();
    return "late";
  });
  const slow = jobs.submit("slow", {});
  const events: string[] = [];
  jobs.subscribe(slow.id, (e) =>
    events.push(e.stage === "job" ? `job:${(e as { status: string }).status}` : e.stage),
  );
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(jobs.cancel(slow.id));
  assert.equal(jobs.get(slow.id)?.status, "cancelled");
  assert.ok(events.includes("job:cancelled"));
  assert.equal(jobs.cancel(slow.id), false);
  assert.throws(() => jobs.submit("unknown", {}), /No runner/);
  assert.equal(jobs.count({ status: "succeeded" }), 1);
});

test("interrupted jobs are failed on restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobs2-"));
  const store = new Store(dir);
  store.collection("jobs").put({
    id: "zombie",
    kind: "x",
    status: "running",
    progress: 0,
    input: {},
    events: [],
    durationsMs: {},
  } as never);
  store.flushAll();
  const log = new Logger({ level: "error", write: () => undefined });
  const jobs = new JobManager(new Store(dir), log);
  assert.equal(jobs.get("zombie")?.status, "failed");
});
