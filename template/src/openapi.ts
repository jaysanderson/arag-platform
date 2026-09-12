/** OpenAPI 3.1 document for __PRODUCT_TITLE__ — the single source of truth for the public API. */
import {
  buildOpenApi,
  jsonBody,
  jsonResponse,
  pageSchema,
  standardResponses,
} from "../vendor/arag-platform/src/index.ts";

export const VERSION = "0.1.0";

const NoteCreate = {
  type: "object",
  required: ["title", "body"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200, description: "Short title" },
    body: {
      type: "string",
      minLength: 1,
      maxLength: 20000,
      description: "Note text ingested into the Knowledge Box",
    },
  },
  additionalProperties: false,
};
const Note = {
  type: "object",
  required: ["id", "title", "resourceId", "status", "createdAt"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    resourceId: { type: "string", description: "ARAG resource id" },
    status: { type: "string", enum: ["PENDING", "PROCESSED", "ERROR", "UNKNOWN"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};
const AskRequest = {
  type: "object",
  required: ["question"],
  properties: { question: { type: "string", minLength: 1, maxLength: 1200 }, noteId: { type: "string" } },
  additionalProperties: false,
};
const AskResponse = {
  type: "object",
  required: ["answer", "sources", "ms"],
  properties: {
    answer: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
    ms: { type: "integer" },
  },
};

export const openapi = buildOpenApi({
  info: {
    title: "__PRODUCT_TITLE__ API",
    version: VERSION,
    description: "Reference product on Progress Agentic RAG: ingest notes, ask grounded questions.",
  },
  tags: [
    { name: "notes", description: "Notes ingested into the Knowledge Box" },
    { name: "ask", description: "Grounded question answering" },
    { name: "jobs", description: "Asynchronous work" },
    { name: "admin", description: "Operator endpoints (ADMIN_TOKEN)" },
    { name: "system", description: "Health and session" },
  ],
  schemas: { NoteCreate, Note, NotePage: pageSchema("#/components/schemas/Note"), AskRequest, AskResponse },
  paths: {
    "/api/v1/notes": {
      get: {
        operationId: "listNotes",
        tags: ["notes"],
        summary: "List notes",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "page_size",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        ],
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/NotePage" }), ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
      post: {
        operationId: "createNote",
        tags: ["notes"],
        summary: "Create a note (ingests into ARAG, returns a job)",
        requestBody: jsonBody({ $ref: "#/components/schemas/NoteCreate" }),
        responses: {
          202: jsonResponse(
            {
              type: "object",
              required: ["note", "job"],
              properties: {
                note: { $ref: "#/components/schemas/Note" },
                job: { $ref: "#/components/schemas/Job" },
              },
            },
            "Accepted",
          ),
          ...standardResponses,
        },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/notes/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getNote",
        tags: ["notes"],
        summary: "Get a note",
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/Note" }), ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
      delete: {
        operationId: "deleteNote",
        tags: ["notes"],
        summary: "Delete a note and its ARAG resource",
        responses: { 204: { description: "Deleted" }, ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/ask": {
      post: {
        operationId: "ask",
        tags: ["ask"],
        summary: "Ask a grounded question over all notes (or one note)",
        requestBody: jsonBody({ $ref: "#/components/schemas/AskRequest" }),
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/AskResponse" }), ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/jobs": {
      get: {
        operationId: "listJobs",
        tags: ["jobs"],
        summary: "List jobs",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["queued", "running", "succeeded", "failed", "cancelled"] },
          },
        ],
        responses: {
          200: jsonResponse({
            type: "object",
            properties: { items: { type: "array", items: { $ref: "#/components/schemas/Job" } } },
          }),
          ...standardResponses,
        },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/jobs/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getJob",
        tags: ["jobs"],
        summary: "Get a job",
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/Job" }), ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
      delete: {
        operationId: "cancelJob",
        tags: ["jobs"],
        summary: "Cancel a job",
        responses: { 204: { description: "Cancelled" }, ...standardResponses },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/jobs/{id}/events": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "jobEvents",
        tags: ["jobs"],
        summary: "Server-sent events for a job (event: event|job)",
        responses: {
          200: {
            description: "text/event-stream",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          ...standardResponses,
        },
        security: [{ ApiKey: [] }, { Bearer: [] }],
      },
    },
    "/api/v1/session": {
      post: {
        operationId: "createSession",
        tags: ["system"],
        summary: "Issue a same-origin session cookie for the demo UI",
        responses: {
          200: jsonResponse({
            type: "object",
            properties: { ok: { type: "boolean" }, expiresInSec: { type: "integer" } },
          }),
          ...standardResponses,
        },
      },
    },
    "/api/v1/admin/health": {
      get: {
        operationId: "adminHealth",
        tags: ["admin"],
        summary: "Service + ARAG connectivity",
        responses: { 200: jsonResponse({ $ref: "#/components/schemas/Health" }), ...standardResponses },
        security: [{ AdminToken: [] }],
      },
    },
    "/api/v1/admin/config": {
      get: {
        operationId: "adminConfig",
        tags: ["admin"],
        summary: "Effective configuration (secrets redacted)",
        responses: {
          200: jsonResponse({ type: "object", additionalProperties: true }),
          ...standardResponses,
        },
        security: [{ AdminToken: [] }],
      },
    },
    "/api/v1/admin/usage": {
      get: {
        operationId: "adminUsage",
        tags: ["admin"],
        summary: "Usage counters",
        responses: {
          200: jsonResponse({ type: "object", additionalProperties: true }),
          ...standardResponses,
        },
        security: [{ AdminToken: [] }],
      },
    },
    "/api/v1/admin/logs": {
      get: {
        operationId: "adminLogs",
        tags: ["admin"],
        summary: "Recent log records",
        parameters: [
          {
            name: "level",
            in: "query",
            schema: { type: "string", enum: ["debug", "info", "warn", "error"] },
          },
          { name: "contains", in: "query", schema: { type: "string", maxLength: 200 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 200 } },
        ],
        responses: {
          200: jsonResponse({
            type: "object",
            properties: { items: { type: "array", items: { $ref: "#/components/schemas/LogRecord" } } },
          }),
          ...standardResponses,
        },
        security: [{ AdminToken: [] }],
      },
    },
    "/api/v1/admin/login": {
      post: {
        operationId: "adminLogin",
        tags: ["admin"],
        summary: "Exchange the admin token for an HttpOnly cookie",
        requestBody: jsonBody({
          type: "object",
          required: ["token"],
          properties: { token: { type: "string" } },
        }),
        responses: {
          200: jsonResponse({ type: "object", properties: { ok: { type: "boolean" } } }),
          ...standardResponses,
        },
      },
    },
  },
});
