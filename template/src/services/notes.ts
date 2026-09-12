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

  /**
   * Filter → sort → page, in that order, so `total` is the size of the FILTERED set: a list view
   * that says "1–25 of 312" while showing a search result is lying about how much is left.
   */
  list(opts: { page: number; pageSize: number; q?: string; status?: string; sort?: string }): {
    items: Note[];
    page: number;
    page_size: number;
    total: number;
    next_page: boolean;
  } {
    const q = (opts.q ?? "").trim().toLowerCase();
    let rows = this.col.list();
    if (q) rows = rows.filter((n) => n.title.toLowerCase().includes(q));
    if (opts.status) rows = rows.filter((n) => n.status === opts.status);
    const [field = "createdAt", dir = "desc"] = (opts.sort ?? "createdAt:desc").split(":");
    const sign = dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = String(a[field as keyof Note] ?? "");
      const bv = String(b[field as keyof Note] ?? "");
      return av === bv ? 0 : (av < bv ? -1 : 1) * sign;
    });
    const total = rows.length;
    const offset = (opts.page - 1) * opts.pageSize;
    return {
      items: rows.slice(offset, offset + opts.pageSize),
      page: opts.page,
      page_size: opts.pageSize,
      total,
      next_page: offset + opts.pageSize < total,
    };
  }

  /** Counts by status, for the overview's stat strip and the list's filter chips. */
  counts(): Record<string, number> {
    const out: Record<string, number> = { total: 0, PENDING: 0, PROCESSED: 0, ERROR: 0, UNKNOWN: 0 };
    for (const n of this.col.list()) {
      out.total = (out.total ?? 0) + 1;
      out[n.status] = (out[n.status] ?? 0) + 1;
    }
    return out;
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

  /** Bulk delete. Reports what actually went, rather than pretending every id existed. */
  async deleteMany(ids: readonly string[]): Promise<{ deleted: number; missing: number }> {
    let deleted = 0;
    let missing = 0;
    for (const id of ids) {
      if (await this.delete(id)) deleted++;
      else missing++;
    }
    return { deleted, missing };
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
