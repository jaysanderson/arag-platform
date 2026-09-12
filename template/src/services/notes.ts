/** Domain logic for notes: ingest into ARAG, track processing as a job, ask grounded questions. No HTTP here. */
import type {
  AragClient,
  JobManager,
  Logger,
  PlatformEnv,
  Store,
  StoredDoc,
} from "../../vendor/arag-platform/src/index.ts";

export interface Note extends StoredDoc {
  title: string;
  resourceId: string;
  status: "PENDING" | "PROCESSED" | "ERROR" | "UNKNOWN";
}

export interface NotesDeps {
  arag: AragClient;
  store: Store;
  jobs: JobManager;
  env: PlatformEnv;
  log: Logger;
}

export class NotesService {
  private readonly d: NotesDeps;
  private readonly col;

  constructor(deps: NotesDeps) {
    this.d = deps;
    this.col = deps.store.collection<Note>("notes");
    deps.jobs.register<{ noteId: string }, { status: string }>("ingest-note", async (ctx) => {
      const note = this.col.get(ctx.job.input.noteId);
      if (!note) throw new Error("note not found");
      const status = await ctx.stage("process", "Waiting for ARAG to process the note", () =>
        this.d.arag.waitProcessed(note.resourceId, {
          timeoutMs: 120_000,
          intervalMs: 1500,
          signal: ctx.signal,
        }),
      );
      await ctx.stage(
        "index",
        "Waiting for the note to become searchable",
        () => this.d.arag.waitSearchable(note.resourceId, { signal: ctx.signal }),
        { soft: true, progress: 0.9 },
      );
      this.col.update(note.id, { status: (status as Note["status"]) ?? "UNKNOWN" });
      return { status: status ?? "UNKNOWN" };
    });
  }

  list(
    page: number,
    pageSize: number,
  ): { items: Note[]; page: number; page_size: number; total: number; next_page: boolean } {
    const total = this.col.size;
    const items = this.col.list({ offset: (page - 1) * pageSize, limit: pageSize });
    return { items, page, page_size: pageSize, total, next_page: page * pageSize < total };
  }

  get(id: string): Note | undefined {
    return this.col.get(id);
  }

  async create(input: {
    title: string;
    body: string;
  }): Promise<{ note: Note; job: ReturnType<JobManager["submit"]> }> {
    const { uuid } = await this.d.arag.createResource({
      title: input.title,
      icon: "text/plain",
      texts: { body: { body: input.body, format: "PLAIN" } },
    });
    const note = this.col.put({ id: uuid, title: input.title, resourceId: uuid, status: "PENDING" });
    const job = this.d.jobs.submit("ingest-note", { noteId: note.id }, { ref: note.id });
    this.d.log.info("note.created", { noteId: note.id, jobId: job.id });
    return { note, job };
  }

  async delete(id: string): Promise<boolean> {
    const note = this.col.get(id);
    if (!note) return false;
    await this.d.arag
      .deleteResource(note.resourceId)
      .catch((err) => this.d.log.warn("note.delete.arag", { id, message: (err as Error).message }));
    return this.col.delete(id);
  }

  async ask(question: string, noteId?: string): Promise<{ answer: string; sources: string[]; ms: number }> {
    const note = noteId ? this.col.get(noteId) : undefined;
    const res = await this.d.arag.ask({
      query: question,
      citations: true,
      resource_filters: note ? [note.resourceId] : undefined,
      prompt: {
        system:
          "Answer using only the provided context. If the answer is not in the context, say you don't have that information.",
      },
      max_tokens: 300,
      temperature: 0,
      generative_model: this.d.env.arag.generativeModel || undefined,
      reranker: this.d.env.arag.reranker,
    });
    return { answer: res.answerText, sources: res.sourceTitles, ms: res.timings.totalMs };
  }
}
