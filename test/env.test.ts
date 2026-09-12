import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertAragEnv, describeEnv, loadDotEnv, parseDotEnv, readEnv } from "../src/config/env.ts";

test("parseDotEnv handles comments, quotes and export prefix", () => {
  const out = parseDotEnv(`# c\nA=1\nexport B="two words"\nC='x'\nBAD\n D = spaced \n`);
  assert.deepEqual(out, { A: "1", B: "two words", C: "x", D: "spaced" });
});

test("loadDotEnv never overrides real env and returns the path used", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-"));
  const p = join(dir, ".env");
  writeFileSync(p, "ZZ_TEST_A=file\nZZ_TEST_B=file\n");
  process.env.ZZ_TEST_A = "real";
  const used = loadDotEnv([p]);
  assert.equal(used, p);
  assert.equal(process.env.ZZ_TEST_A, "real");
  assert.equal(process.env.ZZ_TEST_B, "file");
  assert.equal(loadDotEnv([join(dir, "missing")]), null);
});

test("readEnv applies defaults, lists, numbers and booleans", () => {
  const env = readEnv({
    PORT: "9001",
    API_KEYS: "a, b ,",
    ALLOWED_ORIGINS: "*",
    ARAG_MOCK: "true",
    ARAG_KB_ID: "kb",
    RATE_LIMIT_RPS: "2",
  });
  assert.equal(env.port, 9001);
  assert.deepEqual(env.apiKeys, ["a", "b"]);
  assert.deepEqual(env.allowedOrigins, ["*"]);
  assert.equal(env.arag.mock, true);
  assert.equal(env.rateLimitRps, 2);
  assert.equal(env.arag.region, "aws-us-east-2-1");
  assert.throws(() => readEnv({ PORT: "abc" }), /must be a number/);
  assert.throws(() => readEnv({ LOG_LEVEL: "loud" }), /LOG_LEVEL/);
});

test("assertAragEnv reports missing credentials unless mock", () => {
  assert.throws(() => assertAragEnv(readEnv({})), /ARAG_KB_ID, ARAG_API_KEY/);
  assert.doesNotThrow(() => assertAragEnv(readEnv({ ARAG_MOCK: "1" })));
  assert.doesNotThrow(() =>
    assertAragEnv(readEnv({ ARAG_KB_ID: "k", ARAG_API_KEY: "s", ARAG_REGION: "europe-1" })),
  );
});

test("describeEnv redacts secrets", () => {
  const d = describeEnv(
    readEnv({ ARAG_API_KEY: "supersecretvalue", ADMIN_TOKEN: "admintoken123", API_KEYS: "k1,k2" }),
  ) as { arag: { apiKey: string }; adminToken: string; apiKeys: string[] };
  assert.match(d.arag.apiKey, /^supe…\(16\)$/);
  assert.match(d.adminToken, /^admi…/);
  assert.deepEqual(d.apiKeys, ["•••", "•••"]);
});
