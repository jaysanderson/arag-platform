/**
 * Operator console for __PRODUCT_TITLE__ — consumes /api/v1/admin/* only; auth via HttpOnly cookie.
 *
 * The same rail shell as the product, with its own navigation. Sections are hash routes, so the
 * rail's `aria-current` and the browser's Back button agree with each other.
 */
import { announce, api, esc, fmtRelative, sortRows, toast, wireTable } from "/ui/arag-ui.js";

const $ = (s, root = document) => root.querySelector(s);
const SECTIONS = ["overview", "config", "jobs", "logs"];

function currentSection() {
  const h = location.hash.replace(/^#/, "");
  return SECTIONS.includes(h) ? h : "overview";
}

function showSection() {
  const active = currentSection();
  for (const p of document.querySelectorAll("[data-panel]")) p.hidden = p.dataset.panel !== active;
  for (const a of document.querySelectorAll('.arag-railnav a[href^="#"]')) {
    if (a.getAttribute("href") === `#${active}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = `${active[0].toUpperCase()}${active.slice(1)} · admin · ${document.title.split("·").pop().trim()}`;
  if (active === "jobs") loadJobs();
}

function show(authed) {
  $("#login").hidden = authed;
  $("#panel").hidden = !authed;
  if (!authed) return;
  // Components mounted before sign-in rendered 401s; reload them now that the cookie is set.
  for (const el of document.querySelectorAll("arag-health, arag-json[src], arag-log")) el.load?.();
  loadUsage();
  showSection();
}

async function check() {
  try {
    await api("/api/v1/admin/health");
    show(true);
  } catch (e) {
    show(false);
    if (e.status === 403) {
      $("#loginError").hidden = false;
      $("#loginError").textContent = e.message;
    }
  }
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#signin");
  btn.disabled = true;
  try {
    await api("/api/v1/admin/login", { method: "POST", json: { token: $("#token").value } });
    $("#token").value = "";
    $("#loginError").hidden = true;
    toast("Signed in");
    await check();
  } catch (err) {
    $("#loginError").hidden = false;
    $("#loginError").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

async function loadUsage() {
  try {
    const u = await api("/api/v1/admin/usage");
    const tile = (label, value, sub) =>
      `<div><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span><span class="sub">${esc(sub)}</span></div>`;
    $("#usageStrip").innerHTML = [
      tile("Requests", u.requests ?? 0, "since boot"),
      tile("ARAG calls", u.aragCalls ?? 0, `${u.aragErrors ?? 0} failed`),
      tile("Avg ARAG", `${u.aragCalls ? Math.round(u.aragMs / u.aragCalls) : 0} ms`, "per call"),
      tile("Uptime", `${Math.round((u.uptimeSec ?? 0) / 60)} min`, "process"),
    ].join("");
  } catch {
    $("#usageStrip").hidden = true;
  }
}

let jobSort = { key: "createdAt", dir: "descending" };
async function loadJobs() {
  const table = $("#jobsTable");
  table.setAttribute("aria-busy", "true");
  const d = await api("/api/v1/jobs");
  const rows = sortRows(d.items, jobSort);
  const chip = { succeeded: "ok", failed: "danger", cancelled: "warn" };
  $("#jobsTable tbody").innerHTML =
    rows
      .map(
        (j) => `<tr data-id="${esc(j.id)}" tabindex="0">
          <td>${esc(j.kind)}</td>
          <td><span class="arag-chip ${chip[j.status] ?? "info"}">${esc(j.status)}</span></td>
          <td class="muted small">${esc(j.stage ?? "—")}</td>
          <td class="muted small" title="${esc(j.createdAt)}">${esc(fmtRelative(j.createdAt))}</td>
        </tr>`,
      )
      .join("") || '<tr><td colspan="4" class="muted">No jobs yet.</td></tr>';
  table.removeAttribute("aria-busy");
  wireTable(table, {
    onSort: (s) => {
      jobSort = s.key ? s : { key: "createdAt", dir: "descending" };
      loadJobs();
    },
    onOpen: async (id) => {
      const j = await api(`/api/v1/jobs/${id}`);
      $("#jobDetail").job = j;
      $("#jobJson").data = j;
      announce(`Job ${j.kind} ${j.status}`);
      for (const tr of document.querySelectorAll("#jobsTable tbody tr"))
        tr.setAttribute("aria-selected", String(tr.dataset.id === id));
    },
  });
}

$("#reloadJobs").addEventListener("click", loadJobs);
$("#reloadAll").addEventListener("click", () => {
  for (const el of document.querySelectorAll("arag-health, arag-json[src], arag-log")) el.load?.();
  loadUsage();
});
$("#level").addEventListener("change", (e) => {
  $("#log").setAttribute("level", e.target.value);
  $("#log").load();
});
$("#contains").addEventListener("change", (e) => {
  $("#log").setAttribute("contains", e.target.value);
  $("#log").load();
});
window.addEventListener("hashchange", showSection);
check();
