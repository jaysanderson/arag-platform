import { type App, notFound, operationSchemas } from "../../vendor/arag-platform/src/index.ts";
import { openapi } from "../openapi.ts";
import type { NotesService } from "../services/notes.ts";

export function registerNoteRoutes(app: App, deps: { notes: NotesService }): void {
  app.get(
    "/api/v1/notes",
    (ctx) =>
      deps.notes.list({
        page: Number(ctx.queryObj.page ?? 1),
        pageSize: Number(ctx.queryObj.page_size ?? 50),
        q: ctx.queryObj.q as string | undefined,
        status: ctx.queryObj.status as string | undefined,
        sort: ctx.queryObj.sort as string | undefined,
      }),
    {
      auth: "api",
      validate: operationSchemas(openapi, "/api/v1/notes", "get"),
      operationId: "listNotes",
    },
  );
  // Bulk delete is a POST to its own path: DELETE-with-a-body is something proxies and fetch()
  // implementations disagree about. It is declared BEFORE /api/v1/notes/:id so the literal wins.
  app.post("/api/v1/notes/bulk-delete", (ctx) => deps.notes.deleteMany((ctx.body as { ids: string[] }).ids), {
    auth: "api",
    validate: operationSchemas(openapi, "/api/v1/notes/bulk-delete", "post"),
    operationId: "deleteNotes",
  });
  app.post(
    "/api/v1/notes",
    async (ctx) => {
      const out = await deps.notes.create(ctx.body as { title: string; body: string });
      ctx.json(202, out, { Location: `/api/v1/notes/${out.note.id}` });
    },
    { auth: "api", validate: operationSchemas(openapi, "/api/v1/notes", "post"), operationId: "createNote" },
  );
  app.get(
    "/api/v1/notes/:id",
    (ctx) =>
      deps.notes.get(ctx.params.id!) ??
      (() => {
        throw notFound("Note");
      })(),
    {
      auth: "api",
      validate: operationSchemas(openapi, "/api/v1/notes/{id}", "get"),
      operationId: "getNote",
    },
  );
  app.delete(
    "/api/v1/notes/:id",
    async (ctx) => {
      if (!(await deps.notes.delete(ctx.params.id!))) throw notFound("Note");
      ctx.noContent();
    },
    { auth: "api", operationId: "deleteNote" },
  );
}
