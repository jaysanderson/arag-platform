/**
 * App wiring for __PRODUCT_TITLE__. Everything HTTP lives here and in routes/; domain logic in services/.
 * Exported as a factory so tests can boot the product in-process against the mock ARAG.
 */
import { resolve } from "node:path";
import {
  App,
  AragClient,
  cors,
  log as defaultLog,
  healthRoutes,
  JobManager,
  type Logger,
  type PlatformEnv,
  readBranding,
  Store,
  securityHeaders,
  startMockArag,
} from "../vendor/arag-platform/src/index.ts";
import { openapi, VERSION } from "./openapi.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerAskRoutes } from "./routes/ask.ts";
import { registerJobRoutes } from "./routes/jobs.ts";
import { registerNoteRoutes } from "./routes/notes.ts";
import { NotesService } from "./services/notes.ts";

export interface Product {
  name: string;
  version: string;
  app: App;
  arag: AragClient;
  store: Store;
  jobs: JobManager;
  notes: NotesService;
  usage: Usage;
  close(): Promise<void>;
}

export interface Usage {
  startedAt: number;
  requests: number;
  aragCalls: number;
  aragErrors: number;
  aragMs: number;
}

const HERE = resolve(import.meta.dirname ?? ".", "..");

export async function createProduct(
  env: PlatformEnv,
  opts: { log?: Logger; persist?: boolean } = {},
): Promise<Product> {
  const log = opts.log ?? defaultLog;
  const usage: Usage = { startedAt: Date.now(), requests: 0, aragCalls: 0, aragErrors: 0, aragMs: 0 };

  // ARAG: live client, or the in-process mock when ARAG_MOCK=1 (no credentials needed).
  let mock: Awaited<ReturnType<typeof startMockArag>> | null = null;
  let aragOpts = {
    kbId: env.arag.kbId,
    apiKey: env.arag.apiKey,
    baseUrl: env.arag.baseUrl || undefined,
    region: env.arag.region,
  };
  if (env.arag.mock) {
    mock = await startMockArag({ log });
    aragOpts = { kbId: mock.kbId, apiKey: mock.apiKey, baseUrl: mock.url, region: env.arag.region };
    log.warn("arag.mock", { url: mock.url });
  }
  const arag = new AragClient({
    ...aragOpts,
    timeoutMs: env.arag.timeoutMs,
    onRequest: (i) => {
      usage.aragCalls++;
      usage.aragMs += i.ms;
      if (i.error || (i.status ?? 0) >= 400) usage.aragErrors++;
      log.debug("arag.request", {
        method: i.method,
        path: i.path,
        status: i.status,
        ms: Math.round(i.ms),
        error: i.error,
      });
    },
  });

  const store = new Store(env.dataDir, { persist: opts.persist ?? true });
  const jobs = new JobManager(store, log);
  const notes = new NotesService({ arag, store, jobs, env, log });

  const app = new App({ env, log });
  app.use(securityHeaders(), cors());
  app.use(async (_ctx, next) => {
    usage.requests++;
    await next();
  });
  healthRoutes(app, async () => ({
    version: VERSION,
    arag: { ...(await arag.health()), mock: env.arag.mock },
  }));
  app.docs("/api/v1", openapi);

  registerNoteRoutes(app, { notes });
  registerAskRoutes(app, { notes });
  registerJobRoutes(app, { jobs });
  registerAdminRoutes(app, { arag, env, log, usage, store, jobs, version: VERSION });

  // White-label branding (BRAND_* env) — read by the UI kit shell.
  // The branding payload is authoritative for the shell's identity block, so the product's own
  // name and tagline are its defaults here rather than only markup attributes — otherwise an
  // unset BRAND_TAGLINE would blank the tagline the page ships with.
  const branding = readBranding(process.env, {
    productName: "__PRODUCT_TITLE__",
    tagline: "Grounded answers over your notes",
  });
  app.get("/api/v1/branding", () => branding, { operationId: "getBranding", noRateLimit: true });
  app.static("/branding", resolve(env.dataDir, "branding"), { cache: "public, max-age=300" });

  // Session for the demo UI when API keys are enforced (rate-limited like any public route).
  app.post(
    "/api/v1/session",
    (ctx) => {
      ctx.setCookie("arag_session", app.issueSession(12 * 3600), { maxAge: 12 * 3600 });
      return { ok: true, expiresInSec: 12 * 3600 };
    },
    { operationId: "createSession" },
  );

  // Static surfaces: UI kit, admin panel, demo app. UIs consume only /api/v1.
  app.static("/ui", resolve(HERE, "vendor/arag-platform/ui"), { cache: "public, max-age=300" });
  app.static("/admin", resolve(HERE, "admin"));
  // fallback: the operator UI is a single document with real URLs (/notes, /notes/{id}, /settings),
  // so a deep link or a refresh has to reach index.html. Only navigations get it — a missing asset
  // still 404s, and /ui and /admin above opt out for their own subtrees.
  app.static("/", resolve(HERE, "public"), { fallback: true });

  return {
    name: "__PRODUCT_SLUG__",
    version: VERSION,
    app,
    arag,
    store,
    jobs,
    notes,
    usage,
    async close() {
      store.flushAll();
      try {
        await app.close();
      } finally {
        await mock?.close();
      }
    },
  };
}
