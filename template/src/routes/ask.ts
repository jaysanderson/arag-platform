import { type App, operationSchemas } from "../../vendor/arag-platform/src/index.ts";
import { openapi } from "../openapi.ts";
import type { NotesService } from "../services/notes.ts";

export function registerAskRoutes(app: App, deps: { notes: NotesService }): void {
  app.post(
    "/api/v1/ask",
    (ctx) => {
      const b = ctx.body as { question: string; noteId?: string };
      return deps.notes.ask(b.question, b.noteId);
    },
    { auth: "api", validate: operationSchemas(openapi, "/api/v1/ask", "post"), operationId: "ask" },
  );
}
