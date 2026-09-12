import {
  type App,
  type JobManager,
  type JobStatus,
  notFound,
  operationSchemas,
} from "../../vendor/arag-platform/src/index.ts";
import { openapi } from "../openapi.ts";

export function registerJobRoutes(app: App, deps: { jobs: JobManager }): void {
  app.get(
    "/api/v1/jobs",
    (ctx) => ({
      items: deps.jobs.list({ status: ctx.queryObj.status as JobStatus | undefined, limit: 100 }),
    }),
    {
      auth: "api",
      validate: operationSchemas(openapi, "/api/v1/jobs", "get"),
      operationId: "listJobs",
    },
  );
  app.get(
    "/api/v1/jobs/:id",
    (ctx) =>
      deps.jobs.get(ctx.params.id!) ??
      (() => {
        throw notFound("Job");
      })(),
    { auth: "api", operationId: "getJob" },
  );
  app.delete(
    "/api/v1/jobs/:id",
    (ctx) => {
      if (!deps.jobs.get(ctx.params.id!)) throw notFound("Job");
      deps.jobs.cancel(ctx.params.id!);
      ctx.noContent();
    },
    { auth: "api", operationId: "cancelJob" },
  );
  app.get(
    "/api/v1/jobs/:id/events",
    (ctx) => {
      const job = deps.jobs.get(ctx.params.id!);
      if (!job) throw notFound("Job");
      const sse = ctx.sse();
      for (const e of job.events) sse.send("event", e);
      if (["succeeded", "failed", "cancelled"].includes(job.status)) {
        sse.send("job", { job });
        sse.close();
        return;
      }
      const unsub = deps.jobs.subscribe(job.id, (e) => {
        if (e.stage === "job") {
          sse.send("job", e);
          if (["succeeded", "failed", "cancelled"].includes((e as { status: string }).status)) sse.close();
        } else sse.send("event", e);
      });
      sse.onClose(unsub);
    },
    { auth: "api", noRateLimit: true, operationId: "jobEvents" },
  );
}
