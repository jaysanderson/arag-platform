import {
  type App,
  type AragClient,
  type JobManager,
  type Logger,
  type PlatformEnv,
  type Store,
  constantTimeEqual,
  describeEnv,
  operationSchemas,
  unauthorized,
} from "../../vendor/arag-platform/src/index.ts";
import { openapi } from "../openapi.ts";
import type { Usage } from "../server.ts";

export function registerAdminRoutes(
  app: App,
  deps: {
    arag: AragClient;
    env: PlatformEnv;
    log: Logger;
    usage: Usage;
    store: Store;
    jobs: JobManager;
    version: string;
  },
): void {
  app.post(
    "/api/v1/admin/login",
    (ctx) => {
      const { token } = ctx.body as { token: string };
      if (!deps.env.adminToken || !constantTimeEqual(token, deps.env.adminToken)) throw unauthorized("Invalid admin token");
      ctx.setCookie("arag_admin", token, { maxAge: 12 * 3600 });
      return { ok: true };
    },
    { validate: operationSchemas(openapi, "/api/v1/admin/login", "post"), operationId: "adminLogin" },
  );
  app.get(
    "/api/v1/admin/health",
    async () => ({
      ok: true,
      version: deps.version,
      uptimeSec: Math.round((Date.now() - deps.usage.startedAt) / 1000),
      arag: { ...(await deps.arag.health()), mock: deps.env.arag.mock },
    }),
    { auth: "admin", operationId: "adminHealth" },
  );
  app.get(
    "/api/v1/admin/config",
    () => ({ env: describeEnv(deps.env), stores: deps.store.stats(), routes: app.listRoutes() }),
    { auth: "admin", operationId: "adminConfig" },
  );
  app.get(
    "/api/v1/admin/usage",
    () => ({
      ...deps.usage,
      uptimeSec: Math.round((Date.now() - deps.usage.startedAt) / 1000),
      jobs: {
        queued: deps.jobs.count({ status: "queued" }),
        running: deps.jobs.count({ status: "running" }),
        succeeded: deps.jobs.count({ status: "succeeded" }),
        failed: deps.jobs.count({ status: "failed" }),
      },
    }),
    { auth: "admin", operationId: "adminUsage" },
  );
  app.get(
    "/api/v1/admin/logs",
    (ctx) => ({
      items: deps.log.recent({
        level: ctx.queryObj.level as never,
        contains: ctx.queryObj.contains as string | undefined,
        limit: ctx.queryObj.limit as number | undefined,
      }),
    }),
    {
      auth: "admin",
      validate: operationSchemas(openapi, "/api/v1/admin/logs", "get"),
      operationId: "adminLogs",
    },
  );
}
