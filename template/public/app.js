// Demo app for __PRODUCT_TITLE__. Talks ONLY to /api/v1. No secrets in the browser.
import { api, esc, sse, toast } from "/ui/arag-ui.js";

const $ = (s) => document.querySelector(s);
let currentJobClose = null;

async function ensureSession() {
  try {
    await api("/api/v1/session", { method: "POST" });
  } catch {
    /* open API — no session needed */
  }
}

async function loadNotes() {
  const d = await api("/api/v1/notes?page_size=50");
  $("#notes tbody").innerHTML =
    d.items
      .map(
        (n) =>
          `<tr data-id="${esc(n.id)}"><td>${esc(n.title)}</td><td><span class="arag-chip ${n.status === "PROCESSED" ? "ok" : n.status === "ERROR" ? "danger" : "warn"}">${esc(n.status)}</span></td><td class="small muted">${esc(n.createdAt.slice(0, 19).replace("T", " "))}</td><td><button class="arag-btn ghost sm del">Delete</button></td></tr>`,
      )
      .join("") || `<tr><td colspan="4" class="muted">No notes yet — add one.</td></tr>`;
  $("#notes")
    .querySelectorAll(".del")
    .forEach((b) =>
      b.addEventListener("click", async () => {
        await api(`/api/v1/notes/${b.closest("tr").dataset.id}`, { method: "DELETE" });
        toast("Note deleted");
        loadNotes();
      }),
    );
}

async function createNote() {
  $("#create").disabled = true;
  $("#createStatus").textContent = "creating…";
  try {
    const { note, job } = await api("/api/v1/notes", {
      method: "POST",
      json: { title: $("#title").value, body: $("#body").value },
    });
    $("#createStatus").textContent = `note ${note.id.slice(0, 8)}… · job ${job.id.slice(0, 8)}…`;
    const tl = $("#timeline");
    tl.job = job;
    currentJobClose?.();
    currentJobClose = sse(`/api/v1/jobs/${job.id}/events`, {
      event: (e) => tl.apply(e),
      job: (j) => {
        tl.job = j.job ?? j;
        if (["succeeded", "failed"].includes((j.job ?? j).status)) {
          toast(`Job ${(j.job ?? j).status}`, (j.job ?? j).status === "failed" ? "error" : "info");
          loadNotes();
        }
      },
    });
    loadNotes();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    $("#create").disabled = false;
  }
}

async function ask() {
  const q = $("#question").value.trim();
  if (!q) return;
  const box = $("#answer");
  box.insertAdjacentHTML(
    "beforeend",
    `<div class="arag-bubble user">${esc(q)}</div><div class="arag-bubble assistant" id="pending">Thinking…</div>`,
  );
  try {
    const r = await api("/api/v1/ask", { method: "POST", json: { question: q } });
    $("#pending").outerHTML =
      `<div class="arag-bubble assistant">${esc(r.answer)}<div class="arag-row small" style="margin-top:6px">${r.sources.map((s) => `<span class="arag-cite">${esc(s)}</span>`).join("")}<span class="subtle">${r.ms} ms</span></div></div>`;
  } catch (e) {
    $("#pending").outerHTML =
      `<div class="arag-bubble assistant"><span class="arag-chip danger">${esc(e.message)}</span></div>`;
  }
}

$("#create").addEventListener("click", createNote);
$("#ask").addEventListener("click", ask);
$("#question").addEventListener("keydown", (e) => e.key === "Enter" && ask());
$("#refresh").addEventListener("click", loadNotes);
await ensureSession();
loadNotes();
