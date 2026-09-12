/**
 * Operator UI for __PRODUCT_TITLE__.
 *
 * One document, real URLs, no framework — the server serves index.html for any navigation under /
 * (`app.static("/", …, { fallback: true })`), and this file routes on `location.pathname`.
 * Everything it needs comes from the shared UI kit; there are no product-local copies of the
 * shell, the data table, the drawer or the confirm dialog any more.
 *
 * It talks ONLY to /api/v1. No secrets in the browser.
 */
import {
  announce,
  api,
  confirmDialog,
  emptyState,
  errorState,
  esc,
  fmtRelative,
  icon,
  menuButton,
  openDrawer,
  paginate,
  skeletonRows,
  snippet,
  toast,
  tour,
  wireCopy,
  wireTable,
  wireTabs,
} from "/ui/arag-ui.js";

const $ = (s, root = document) => root.querySelector(s);
const view = () => $("#view");
const PAGE_SIZE = 10;

const STATUS_CHIP = { PROCESSED: "ok", PENDING: "warn", ERROR: "danger", UNKNOWN: "neutral" };
const STATUS_TEXT = { PROCESSED: "Ready", PENDING: "Processing", ERROR: "Failed", UNKNOWN: "Unknown" };
/** Status is never carried by colour alone — the chip always says the word too. */
const statusChip = (s) =>
  `<span class="arag-chip ${STATUS_CHIP[s] ?? "neutral"}">${esc(STATUS_TEXT[s] ?? s)}</span>`;

const when = (iso) => `<span title="${esc(iso)}">${esc(fmtRelative(iso))}</span>`;

// ── routing ──────────────────────────────────────────────────────────────────
const routes = [
  [/^\/$/, overview],
  [/^\/notes\/?$/, notesList],
  [/^\/notes\/([^/]+)$/, noteDetail],
  [/^\/ask\/?$/, askView],
  [/^\/settings\/?$/, settings],
];

let token = 0;
async function render() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const mine = ++token;
  for (const [re, handler] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    try {
      await handler({ id: m[1], stale: () => mine !== token });
    } catch (e) {
      if (mine === token) view().innerHTML = errorState(e, { retry: retryButton() });
    }
    // history.pushState fires no event, so the shell is told explicitly which item is current.
    $("arag-app-shell")?.setActivePath?.(path);
    $("#main")?.focus({ preventScroll: true });
    return;
  }
  view().innerHTML = emptyState({
    icon: "alert-triangle",
    title: "Page not found",
    body: `Nothing lives at ${path}.`,
    actions: '<a class="arag-btn" href="/">Back to overview</a>',
  });
}

const retryButton = () => '<button class="arag-btn secondary sm" data-retry>Try again</button>';

function go(href, { replace = false } = {}) {
  history[replace ? "replaceState" : "pushState"]({}, "", href);
  render();
}

// Same-origin links are routed in place; everything else (downloads, /admin/, /api/v1/docs,
// modified clicks) is left to the browser, so middle-click and "open in new tab" still work.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  if (a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
  if (a.pathname.startsWith("/admin") || a.pathname.startsWith("/api") || a.pathname.startsWith("/ui"))
    return;
  e.preventDefault();
  if (a.pathname + a.search !== location.pathname + location.search) go(a.pathname + a.search);
});
document.addEventListener("click", (e) => {
  if (e.target.closest?.("[data-retry]")) render();
});
window.addEventListener("popstate", render);

// ── shared chrome ────────────────────────────────────────────────────────────
function pageHead({ title, sub = "", actions = "", crumbs = null }) {
  return `${crumbs ? breadcrumb(crumbs) : ""}
    <div class="arag-pagehead">
      <div class="row">
        <div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>
        ${actions ? `<div class="actions">${actions}</div>` : ""}
      </div>
    </div>`;
}

const breadcrumb = (items) =>
  `<nav class="arag-breadcrumb" aria-label="Breadcrumb"><ol>${items
    .map((c, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(c.label)}</li>`
        : `<li><a href="${esc(c.href)}">${esc(c.label)}</a></li>`,
    )
    .join("")}</ol></nav>`;

/** New-note drawer — the one creation path, reachable from the overview and the list. */
function newNoteDrawer() {
  const d = openDrawer({
    title: "New note",
    sub: "Ingested into the Knowledge Box, then indexed for grounded answers",
    body: `<div class="arag-stack">
        <div class="arag-field"><label for="nTitle">Title</label>
          <input id="nTitle" class="arag-input" value="Onboarding policy" /></div>
        <div class="arag-field"><label for="nBody">Body</label>
          <textarea id="nBody" class="arag-textarea" style="min-height:200px">New employees receive a laptop on day one. Parking passes are issued by Facilities within three business days. Expense claims must be filed within 30 days.</textarea>
          <span class="arag-help">Plain text. It becomes one ARAG resource.</span></div>
      </div>`,
    foot: `<button class="arag-btn ghost" data-close type="button">Cancel</button>
           <button class="arag-btn" id="nCreate" type="button">Create note</button>`,
  });
  $("#nCreate", d.host).addEventListener("click", async () => {
    const btn = $("#nCreate", d.host);
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      const { note } = await api("/api/v1/notes", {
        method: "POST",
        json: { title: $("#nTitle", d.host).value, body: $("#nBody", d.host).value },
      });
      d.close();
      toast("Note created — processing started");
      go(`/notes/${note.id}`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Create note";
      toast(e.message, "error");
    }
  });
  return d;
}

// ── overview ─────────────────────────────────────────────────────────────────
async function overview({ stale }) {
  view().innerHTML =
    pageHead({ title: "Overview", sub: "Loading…" }) + `<div class="arag-stack">${skeletonRows(4)}</div>`;
  const [all, recent] = await Promise.all([
    api("/api/v1/notes?page=1&page_size=200"),
    api("/api/v1/notes?page=1&page_size=5&sort=createdAt:desc"),
  ]);
  if (stale()) return;
  const by = (s) => all.items.filter((n) => n.status === s).length;

  if (all.total === 0) {
    view().innerHTML =
      pageHead({ title: "Overview", sub: "Nothing has been ingested yet" }) +
      emptyState({
        icon: "document",
        title: "Add your first note",
        body: "A note is ingested into the Knowledge Box, processed, then answerable with citations. The sample note takes about ten seconds.",
        actions: `<button class="arag-btn" id="first">Create a note</button>
                  <a class="arag-btn ghost" href="/api/v1/docs">Read the API docs</a>`,
      });
    $("#first").addEventListener("click", newNoteDrawer);
    return;
  }

  view().innerHTML =
    pageHead({
      title: "Overview",
      sub: "What is in the Knowledge Box and what it is doing",
      actions: '<button class="arag-btn" id="newNote">New note</button>',
    }) +
    `<div class="arag-statstrip" id="stats">
       <a class="tile" href="/notes"><span class="label">Notes</span><span class="value">${all.total}</span><span class="sub">in the Knowledge Box</span></a>
       <a class="tile" href="/notes?status=PROCESSED"><span class="label">Ready</span><span class="value">${by("PROCESSED")}</span><span class="sub">answerable now</span></a>
       <a class="tile" href="/notes?status=PENDING"><span class="label">Processing</span><span class="value">${by("PENDING")}</span><span class="sub">indexing</span></a>
       <a class="tile" href="/notes?status=ERROR"><span class="label">Failed</span><span class="value">${by("ERROR")}</span><span class="sub">need attention</span></a>
     </div>
     <div class="arag-split">
       <section class="arag-card">
         <div class="head"><h2>Recent notes</h2><a class="arag-btn ghost sm" href="/notes">View all</a></div>
         <div class="body" style="padding:0">
           <div class="arag-datatable" style="border:0">
             <div class="scroll"><table>
               <thead><tr><th>Title</th><th>Status</th><th>Added</th></tr></thead>
               <tbody>${recent.items
                 .map(
                   (n) => `<tr data-href="/notes/${esc(n.id)}" tabindex="0">
                     <td><a class="cell-title" href="/notes/${esc(n.id)}">${esc(n.title)}</a></td>
                     <td>${statusChip(n.status)}</td><td class="muted">${when(n.createdAt)}</td></tr>`,
                 )
                 .join("")}</tbody>
             </table></div>
           </div>
         </div>
       </section>
       <section class="arag-stack">
         <div class="arag-card pad">
           <h3>Ask a grounded question</h3>
           <p class="muted small">Answers are drawn only from the notes above, with citations.</p>
           <a class="arag-btn secondary" href="/ask">Open Ask</a>
         </div>
         <div class="arag-card pad">
           <h3>Connection</h3>
           <dl class="arag-kv"><dt>Knowledge Box</dt><dd><arag-status endpoint="/readyz" label="status"></arag-status></dd>
             <dt>API</dt><dd><a href="/api/v1/docs">OpenAPI reference</a></dd></dl>
         </div>
       </section>
     </div>`;
  $("#newNote").addEventListener("click", newNoteDrawer);
  maybeTour();
}

/** Shown once per browser, and never as a blocker: the page underneath stays usable. */
function maybeTour() {
  try {
    if (localStorage.getItem("tpl.tour") === "done") return;
  } catch {
    return;
  }
  tour(
    [
      {
        target: ".arag-statstrip",
        title: "Where things stand",
        body: "Each tile is a filter — click one to see just those notes.",
      },
      { target: '[data-nav="Notes"]', title: "Your notes", body: "Search, sort, select and delete in bulk." },
      {
        target: '[data-nav="Ask"]',
        title: "Grounded answers",
        body: "Ask across everything, or scope a question to one note from its page.",
      },
    ],
    { storageKey: "tpl.tour" },
  );
}

// ── notes list ───────────────────────────────────────────────────────────────
const listState = { page: 1, q: "", status: "", sort: "createdAt:desc", selected: new Set() };

async function notesList({ stale }) {
  const params = new URLSearchParams(location.search);
  listState.status = params.get("status") ?? "";
  listState.q = params.get("q") ?? "";
  listState.page = Number(params.get("page") ?? 1);
  view().innerHTML =
    pageHead({
      title: "Notes",
      sub: "Everything ingested into the Knowledge Box",
      actions: '<button class="arag-btn" id="newNote">New note</button>',
    }) + '<div id="listBody"></div>';
  $("#newNote").addEventListener("click", newNoteDrawer);
  await loadList(stale);
}

async function loadList(stale = () => false) {
  const q = new URLSearchParams({
    page: String(listState.page),
    page_size: String(PAGE_SIZE),
    sort: listState.sort,
  });
  if (listState.q) q.set("q", listState.q);
  if (listState.status) q.set("status", listState.status);
  const host = $("#listBody");
  host.setAttribute("aria-busy", "true");
  const data = await api(`/api/v1/notes?${q}`);
  if (stale()) return;
  const p = paginate(data.total, listState.page, PAGE_SIZE);
  const [sortKey, sortDir] = listState.sort.split(":");
  const aria = (k) => (k === sortKey ? (sortDir === "asc" ? "ascending" : "descending") : "none");
  const col = (key, label, extra = "") =>
    `<th data-sort="${key}" aria-sort="${aria(key)}"${extra}><button type="button">${esc(label)}${icon("chevron-down", { size: 14, cls: "sortic" })}</button></th>`;

  host.innerHTML = `
    <div class="arag-filterbar">
      <div class="arag-search">
        ${icon("search")}
        <input id="q" type="search" placeholder="Search titles" value="${esc(listState.q)}" aria-label="Search notes" />
      </div>
      <select id="status" class="arag-select" aria-label="Filter by status">
        <option value="">All statuses</option>
        ${["PROCESSED", "PENDING", "ERROR", "UNKNOWN"]
          .map(
            (s) =>
              `<option value="${s}"${listState.status === s ? " selected" : ""}>${esc(STATUS_TEXT[s])}</option>`,
          )
          .join("")}
      </select>
      ${listState.q || listState.status ? '<button class="arag-btn ghost sm" id="clear" type="button">Clear filters</button>' : ""}
      <span class="spacer"></span>
      <span class="count">${p.total === 0 ? "No notes" : `${p.from}–${p.to} of ${p.total}`}</span>
    </div>
    ${
      data.items.length === 0
        ? emptyState(
            listState.q || listState.status
              ? {
                  icon: "search",
                  title: "No notes match those filters",
                  body: "Try a different search term, or clear the filters to see everything.",
                  actions:
                    '<button class="arag-btn secondary" id="clear2" type="button">Clear filters</button>',
                }
              : {
                  icon: "document",
                  title: "No notes yet",
                  body: "Create one to see it processed and made answerable.",
                  actions: '<button class="arag-btn" id="first2" type="button">Create a note</button>',
                },
          )
        : `<div class="arag-datatable" id="table">
             <div class="arag-bulkbar" data-bulkbar hidden>
               <span class="count" data-bulk-count aria-live="polite">0 selected</span>
               <span class="spacer"></span>
               <button type="button" class="danger" id="bulkDelete">Delete</button>
               <button type="button" id="bulkClear">Clear selection</button>
             </div>
             <div class="scroll"><table>
               <thead><tr>
                 <th class="check"><input type="checkbox" data-check-all aria-label="Select all notes on this page" /></th>
                 ${col("title", "Title")}${col("status", "Status")}${col("createdAt", "Added")}
                 <th class="rowactions"><span class="sr-only">Actions</span></th>
               </tr></thead>
               <tbody>${data.items
                 .map(
                   (n) => `<tr data-id="${esc(n.id)}" data-href="/notes/${esc(n.id)}" tabindex="0">
                     <td class="check"><input type="checkbox" data-check="${esc(n.id)}" aria-label="Select ${esc(n.title)}" /></td>
                     <td><a class="cell-title" href="/notes/${esc(n.id)}">${esc(n.title)}</a>
                         <span class="cell-sub mono">${esc(n.id.slice(0, 8))}</span></td>
                     <td>${statusChip(n.status)}</td>
                     <td class="muted">${when(n.createdAt)}</td>
                     <td class="rowactions"></td>
                   </tr>`,
                 )
                 .join("")}</tbody>
             </table></div>
             <nav class="arag-pagination" aria-label="Pagination">
               <span class="range">Page ${p.page} of ${p.pages}</span>
               <span class="spacer"></span>
               <button type="button" data-page="prev"${p.hasPrev ? "" : " disabled"}>Previous</button>
               <button type="button" data-page="next"${p.hasNext ? "" : " disabled"}>Next</button>
             </nav>
           </div>`
    }`;
  host.removeAttribute("aria-busy");

  $("#clear")?.addEventListener("click", clearFilters);
  $("#clear2")?.addEventListener("click", clearFilters);
  $("#first2")?.addEventListener("click", newNoteDrawer);
  $("#q")?.addEventListener("change", (e) => {
    listState.q = e.target.value.trim();
    listState.page = 1;
    syncUrl();
  });
  $("#status")?.addEventListener("change", (e) => {
    listState.status = e.target.value;
    listState.page = 1;
    syncUrl();
  });

  const table = $("#table");
  if (!table) return;
  // Row actions: one menu per row, each naming its note so twenty identical triggers stay
  // distinguishable to a screen reader.
  for (const tr of table.querySelectorAll("tbody tr")) {
    const id = tr.dataset.id;
    const title = tr.querySelector(".cell-title")?.textContent ?? "note";
    tr.querySelector(".rowactions")?.appendChild(
      menuButton(
        () => [
          { label: "Open", href: `/notes/${id}` },
          { separator: true },
          {
            label: "Delete",
            danger: true,
            onSelect: async () => {
              const ok = await confirmDialog({
                title: "Delete this note?",
                body: `<p>“<strong>${esc(title)}</strong>” and its Knowledge Box resource are removed.</p>`,
                confirmLabel: "Delete note",
              });
              if (!ok) return;
              await api(`/api/v1/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
              toast("Note deleted");
              loadList();
            },
          },
        ],
        { ariaLabel: `Actions for ${title}` },
      ),
    );
  }
  listState.selected = new Set();
  wireTable(table, {
    selected: listState.selected,
    onSort: ({ key, dir }) => {
      listState.sort = key ? `${key}:${dir === "ascending" ? "asc" : "desc"}` : "createdAt:desc";
      loadList();
    },
    onPage: (which) => {
      listState.page = which === "prev" ? Math.max(1, p.page - 1) : p.page + 1;
      syncUrl();
    },
  });
  $("#bulkClear").addEventListener("click", () => loadList());
  $("#bulkDelete").addEventListener("click", async () => {
    const ids = [...listState.selected];
    const ok = await confirmDialog({
      title: `Delete ${ids.length} note${ids.length === 1 ? "" : "s"}?`,
      body: `<p>This removes ${ids.length === 1 ? "the note" : "the notes"} and the matching resource${ids.length === 1 ? "" : "s"} in the Knowledge Box. Answers will no longer cite ${ids.length === 1 ? "it" : "them"}.</p>`,
      // Type-to-confirm, because there is no undo on the far side of this.
      typed: ids.length > 1 ? `delete ${ids.length}` : null,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await api("/api/v1/notes/bulk-delete", { method: "POST", json: { ids } });
    toast(`${res.deleted} deleted`);
    announce(`${res.deleted} notes deleted`);
    loadList();
  });
}

function clearFilters() {
  listState.q = "";
  listState.status = "";
  listState.page = 1;
  syncUrl();
}

function syncUrl() {
  const q = new URLSearchParams();
  if (listState.q) q.set("q", listState.q);
  if (listState.status) q.set("status", listState.status);
  if (listState.page > 1) q.set("page", String(listState.page));
  go(`/notes${q.toString() ? `?${q}` : ""}`, { replace: true });
}

// ── note detail ──────────────────────────────────────────────────────────────
const TABS = [
  ["overview", "Overview"],
  ["processing", "Processing"],
  ["ask", "Ask this note"],
];

async function noteDetail({ id, stale }) {
  view().innerHTML = skeletonRows(5);
  const note = await api(`/api/v1/notes/${encodeURIComponent(id)}`);
  if (stale()) return;
  const active = new URLSearchParams(location.search).get("tab") ?? "overview";

  view().innerHTML =
    pageHead({
      crumbs: [{ label: "Notes", href: "/notes" }, { label: note.title }],
      title: note.title,
      sub: `Added ${fmtRelative(note.createdAt)}`,
      actions: `${statusChip(note.status)}<button class="arag-btn ghost" id="del" type="button">Delete</button>`,
    }) +
    `<div class="arag-tabs" role="tablist" id="tabs">
       ${TABS.map(
         ([key, label]) =>
           `<a role="tab" href="/notes/${esc(note.id)}?tab=${key}" aria-selected="${active === key}">${esc(label)}</a>`,
       ).join("")}
     </div>
     <div id="panel" role="tabpanel" style="margin-top:20px"></div>`;
  wireTabs($("#tabs"), $("#panel"));
  $("#del").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Delete this note?",
      body: `<p>“<strong>${esc(note.title)}</strong>” and its Knowledge Box resource are removed. Answers will no longer cite it.</p>`,
      confirmLabel: "Delete note",
    });
    if (!ok) return;
    await api(`/api/v1/notes/${encodeURIComponent(note.id)}`, { method: "DELETE" });
    toast("Note deleted");
    go("/notes");
  });

  const panel = $("#panel");
  if (active === "processing") {
    panel.innerHTML = `<div class="arag-card"><div class="head"><h2>Processing</h2></div>
      <div class="body"><arag-job-timeline></arag-job-timeline></div></div>`;
    const job = (await api(`/api/v1/jobs?ref=${encodeURIComponent(note.id)}`).catch(() => null))?.items?.[0];
    const tl = panel.querySelector("arag-job-timeline");
    if (job) {
      tl.job = await api(`/api/v1/jobs/${job.id}`);
      if (job.status === "queued" || job.status === "running")
        tl.setAttribute("events-src", `/api/v1/jobs/${job.id}/events`);
    } else tl.innerHTML = '<p class="muted">No processing job recorded for this note.</p>';
  } else if (active === "ask") {
    panel.innerHTML = askPanel(note.id);
    wireAsk(note.id);
  } else {
    panel.innerHTML = `<div class="arag-split">
        <div class="arag-card pad">
          <h2>Record</h2>
          <dl class="arag-kv" style="margin-top:10px">
            <dt>Title</dt><dd>${esc(note.title)}</dd>
            <dt>Status</dt><dd>${statusChip(note.status)}</dd>
            <dt>Added</dt><dd>${when(note.createdAt)}</dd>
            <dt>Note id</dt><dd class="mono small">${esc(note.id)}</dd>
            <dt>ARAG resource</dt><dd class="mono small">${esc(note.resourceId)}</dd>
          </dl>
        </div>
        <div class="arag-card pad">
          <h2>Fetch it from the API</h2>
          <p class="muted small">Every screen here is one public endpoint away.</p>
          ${snippet(`curl ${location.origin}/api/v1/notes/${note.id} \\\n  -H "X-API-Key: $API_KEY"`)}
        </div>
      </div>`;
    wireCopy(panel);
  }
}

// ── ask ──────────────────────────────────────────────────────────────────────
const askPanel = (noteId) => `
  <div class="arag-card">
    <div class="head"><h2>${noteId ? "Ask this note" : "Ask"}</h2>
      <span class="muted small">Answers come only from ${noteId ? "this note" : "your notes"}</span></div>
    <div class="body arag-stack">
      <div id="answers" class="arag-chat"></div>
      <div class="arag-row">
        <input id="question" class="arag-input" style="flex:1 1 320px"
               value="When must expense claims be filed?" aria-label="Your question" />
        <button id="ask" class="arag-btn">Ask</button>
      </div>
    </div>
  </div>`;

function wireAsk(noteId) {
  const run = async () => {
    const q = $("#question").value.trim();
    if (!q) return;
    const box = $("#answers");
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="arag-bubble user">${esc(q)}</div><div class="arag-bubble assistant" id="pending">Thinking…</div>`,
    );
    $("#ask").disabled = true;
    try {
      const r = await api("/api/v1/ask", { method: "POST", json: { question: q, noteId } });
      $("#pending").outerHTML = `<div class="arag-bubble assistant">${esc(r.answer)}
        <div class="arag-row small" style="margin-top:6px">${r.sources
          .map((s) => `<span class="arag-cite">${esc(s)}</span>`)
          .join("")}<span class="subtle">${r.ms} ms</span></div></div>`;
    } catch (e) {
      $("#pending").outerHTML = `<div class="arag-bubble assistant">${errorState(e)}</div>`;
    } finally {
      $("#ask").disabled = false;
    }
  };
  $("#ask").addEventListener("click", run);
  $("#question").addEventListener("keydown", (e) => e.key === "Enter" && run());
}

async function askView() {
  view().innerHTML =
    pageHead({ title: "Ask", sub: "Grounded answers with citations, across every note" }) + askPanel(null);
  wireAsk(null);
}

// ── settings ─────────────────────────────────────────────────────────────────
async function settings({ stale }) {
  const branding = await api("/api/v1/branding").catch(() => ({}));
  if (stale()) return;
  view().innerHTML =
    pageHead({ title: "Settings", sub: "Connection, white-label branding and API access" }) +
    `<div class="arag-stack" style="max-width:900px">
       <section class="arag-card pad">
         <h2>Connection</h2>
         <p class="muted small">Configured with <code>ARAG_KB_ID</code> and <code>ARAG_API_KEY</code>; the browser never sees either.</p>
         <dl class="arag-kv" style="margin-top:10px">
           <dt>Service</dt><dd><arag-status endpoint="/readyz" label="status"></arag-status></dd>
           <dt>API reference</dt><dd><a href="/api/v1/docs">OpenAPI · Redoc</a></dd>
           </dl>
         <a class="arag-btn" href="/admin/" style="margin-top:12px">Open the operator console</a>
       </section>
       <section class="arag-card pad">
         <h2>Branding</h2>
         <p class="muted small">Set by <code>BRAND_*</code> environment variables and read from <code>GET /api/v1/branding</code>. Every element carrying a <code>data-brand-*</code> attribute follows it.</p>
         <dl class="arag-kv" style="margin-top:10px">
           <dt>Product name</dt><dd>${esc(branding.productName ?? "—")}</dd>
           <dt>Tagline</dt><dd>${esc(branding.tagline || "—")}</dd>
           <dt>Mark</dt><dd>${
             branding.logoUrl
               ? `<img src="${esc(branding.logoUrl)}" alt="Partner logo" style="height:22px" /> <span class="muted small">partner logo</span>`
               : '<img src="/ui/brand/arag-logo.svg" alt="Progress Agentic RAG" style="height:16px" /> <span class="muted small">kit default — set BRAND_LOGO_URL to replace it</span>'
           }</dd>
           <dt>Primary colour</dt><dd>${branding.primaryColor ? `<span class="arag-chip" style="background:${esc(branding.primaryColor)};color:#fff">${esc(branding.primaryColor)}</span>` : "kit default"}</dd>
           <dt>Progress credit</dt><dd>${branding.poweredBy === false ? "hidden" : "shown in the brand band"}</dd>
         </dl>
       </section>
       <section class="arag-card pad">
         <h2>API access</h2>
         <p class="muted small">Send an API key as <code>X-API-Key</code>, or an admin token as a bearer.</p>
         ${snippet(`curl ${location.origin}/api/v1/notes \\\n  -H "X-API-Key: $API_KEY"`)}
       </section>
       <section class="arag-card pad">
         <h2>Danger zone</h2>
         <p class="muted small">Removes every note and its Knowledge Box resource. There is no undo.</p>
         <button class="arag-btn danger" id="wipe" type="button">Delete all notes</button>
       </section>
     </div>`;
  wireCopy(view());
  $("#wipe").addEventListener("click", async () => {
    const all = await api("/api/v1/notes?page=1&page_size=200");
    if (!all.total) return toast("There are no notes to delete");
    const ok = await confirmDialog({
      title: "Delete every note?",
      body: `<p>All <strong>${all.total}</strong> notes and their Knowledge Box resources are removed.</p>`,
      typed: "delete everything",
      confirmLabel: "Delete all notes",
    });
    if (!ok) return;
    const res = await api("/api/v1/notes/bulk-delete", {
      method: "POST",
      json: { ids: all.items.map((n) => n.id) },
    });
    toast(`${res.deleted} deleted`);
  });
}

// ── boot ─────────────────────────────────────────────────────────────────────
await api("/api/v1/session", { method: "POST" }).catch(() => undefined);
render();
