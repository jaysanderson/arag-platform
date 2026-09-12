import { type App, notFound, operationSchemas } from "../../vendor/arag-platform/src/index.ts";
import { openapi } from "../openapi.ts";
import type { NotesService } from "../services/notes.ts";

export function registerNoteRoutes(app: App, deps: { notes: NotesService }): void {
  app.get(
    "/api/v1/notes",
    (ctx) => deps.notes.list(Number(ctx.queryObj.page ?? 1), Number(ctx.queryObj.page_size ?? 50)),
    {
      auth: "api",
      validate: operationSchemas(openapi, "/api/v1/notes", "get"),
      operationId: "listNotes",
    },
  );
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
