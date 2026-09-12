/**
 * Opt-in live smoke test of AragClient against a real Knowledge Box (reads ARAG_* from .env).
 * Uploads a small text document, waits for processing, runs find/ask (text + structured), exercises
 * search configurations, labelsets and REMi, then deletes everything it created. Prints a report.
 *   make smoke      (needs ARAG_KB_ID / ARAG_API_KEY / ARAG_REGION in .env — use a sandbox KB)
 */
import { AragClient, loadDotEnv, readEnv } from "../src/index.ts";

loadDotEnv();
const env = readEnv();
if (!env.arag.kbId || !env.arag.apiKey) {
  console.error("ARAG_KB_ID and ARAG_API_KEY are required (.env). Aborting.");
  process.exit(2);
}
const arag = new AragClient({
  kbId: env.arag.kbId,
  apiKey: env.arag.apiKey,
  region: env.arag.region,
  baseUrl: env.arag.baseUrl || undefined,
  timeoutMs: 90_000,
});
const results: Array<{ step: string; ok: boolean; ms: number; note?: string }> = [];
async function step<T>(name: string, fn: () => Promise<T>, note?: (v: T) => string): Promise<T | undefined> {
  const t0 = performance.now();
  try {
    const v = await fn();
    results.push({ step: name, ok: true, ms: Math.round(performance.now() - t0), note: note?.(v) });
    return v;
  } catch (err) {
    results.push({
      step: name,
      ok: false,
      ms: Math.round(performance.now() - t0),
      note: (err as Error).message,
    });
    return undefined;
  }
}

const TEXT = `ACME ROBOTICS PTY LTD\nTAX INVOICE\nInvoice Number: INV-2026-0042\nInvoice Date: 15/06/2026\nDue Date: 15/07/2026\nBill To: Progress Software Corporation\n\nIndustrial 3D Printer (Model X9) x2 $96,000.00\nInstallation $3,200.00\n\nSubtotal: $99,200.00\nGST (10%): $9,920.00\nTOTAL DUE: $109,120.00 AUD`;
let rid: string | undefined;
const cfgName = `smoke_${Date.now().toString(36)}`;
const labelset = `smoke_labels_${Date.now().toString(36)}`;
try {
  const h = await step(
    "health",
    () => arag.health(),
    (v) => `ok=${v.ok} resources=${v.resources} model=${v.generativeModel}`,
  );
  if (!h?.ok) throw new Error("health failed");
  const up = await step(
    "upload",
    () => arag.upload(Buffer.from(TEXT), "smoke-invoice.txt", "text/plain"),
    (v) => `uuid=${v.uuid}`,
  );
  rid = up?.uuid;
  if (!rid) throw new Error("upload failed");
  await step(
    "waitProcessed",
    () => arag.waitProcessed(rid!, { timeoutMs: 180_000, intervalMs: 3000 }),
    (v) => String(v),
  );
  await step(
    "waitSearchable",
    () => arag.waitSearchable(rid!, { timeoutMs: 60_000 }),
    (v) => String(v),
  );
  await step(
    "extractedText",
    () => arag.extractedText(rid!),
    (v) => `${v.length} chars`,
  );
  await step(
    "find",
    () => arag.find({ query: "invoice total due", resource_filters: [rid!] }),
    (v) => `resources=${Object.keys(v.resources ?? {}).length}`,
  );
  await step(
    "ask (text + citations)",
    () =>
      arag.ask({
        query: "What is the total due on the invoice?",
        resource_filters: [rid!],
        citations: true,
        temperature: 0,
        max_tokens: 120,
      }),
    (v) =>
      `"${v.answerText.slice(0, 80)}" citations=${Object.keys(v.citations).length} items=${v.items.map((i) => i.type).join(",")}`,
  );
  await step(
    "ask (answer_json_schema + full_resource)",
    () =>
      arag.ask({
        query: TEXT.slice(0, 200),
        resource_filters: [rid!],
        rag_strategies: [{ name: "full_resource" }],
        temperature: 0,
        max_tokens: 400,
        answer_json_schema: {
          name: "invoice_extraction",
          description: "Invoice fields",
          parameters: {
            type: "object",
            properties: {
              vendor_name: { type: "string", description: "Vendor" },
              invoice_number: { type: "string", description: "Invoice number" },
              total: { type: "string", description: "Total due as written" },
            },
            required: ["vendor_name", "invoice_number", "total"],
          },
        },
      }),
    (v) => `json=${JSON.stringify(v.answerJson)}`,
  );
  await step("putSearchConfiguration", () =>
    arag.putSearchConfiguration(cfgName, {
      kind: "ask",
      config: { reranker: "noop", citations: true, prompt: { system: "Answer briefly." } },
    }),
  );
  await step(
    "ask via search_configuration",
    () =>
      arag.ask({
        query: "invoice number",
        resource_filters: [rid!],
        search_configuration: cfgName,
        max_tokens: 60,
      }),
    (v) => `"${v.answerText.slice(0, 60)}"`,
  );
  await step(
    "getSearchConfiguration",
    () => arag.getSearchConfiguration(cfgName),
    (v) => `kind=${v.kind}`,
  );
  await step("putLabelset", () =>
    arag.putLabelset(labelset, { title: "Smoke", kind: ["RESOURCES"], labels: [{ title: "A" }] }),
  );
  await step(
    "listLabelsets",
    () => arag.listLabelsets(),
    (v) => `${Object.keys(v.labelsets).length} labelsets`,
  );
  await step(
    "listTasks",
    () => arag.listTasks(),
    (v) => `configs=${v.configs?.length ?? 0} running=${v.running?.length ?? 0}`,
  );
  await step(
    "remi",
    () =>
      arag.remi({
        user_id: "smoke",
        question: "total due?",
        answer: "The total due is $109,120.00 AUD.",
        contexts: [TEXT],
      }),
    (v) => `relevance=${v.answer_relevance?.score} groundedness=${JSON.stringify(v.groundedness)}`,
  );
  await step(
    "getSchema (models)",
    () => arag.getSchema(),
    (v) => `${Object.keys(v).length} keys`,
  );
} finally {
  if (rid) await step("deleteResource", () => arag.deleteResource(rid!));
  await step("deleteSearchConfiguration", () => arag.deleteSearchConfiguration(cfgName));
  await step("deleteLabelset", () => arag.deleteLabelset(labelset));
}
const failed = results.filter((r) => !r.ok);
console.log(
  results
    .map(
      (r) =>
        `${r.ok ? "PASS" : "FAIL"}  ${r.step.padEnd(40)} ${String(r.ms).padStart(6)} ms  ${r.note ?? ""}`,
    )
    .join("\n"),
);
console.log(
  `\n${results.length - failed.length}/${results.length} passed against KB ${env.arag.kbId} (${arag.baseUrl})`,
);
process.exit(failed.length ? 1 : 0);
