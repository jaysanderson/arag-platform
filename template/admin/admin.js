// Admin panel for __PRODUCT_TITLE__ — consumes /api/v1/admin/* only; auth via HttpOnly cookie.
import { api, esc, toast } from "/ui/arag-ui.js";

const $ = (s) => document.querySelector(s);

async function show(authed) {
  $("#login").hidden = authed;
  $("#panel").hidden = !authed;
  if (authed) {
    // Components mounted before sign-in rendered 401s; reload them now that the cookie is set.
    document.querySelectorAll("arag-health, arag-json[src], arag-log").forEach((el) => el.load?.());
    loadJobs();
  }
}

async function check() {
  try {
    await api("/api/v1/admin/health");
    show(true);
  } catch (e) {
    if (e.status === 403) {
      $("#login").hidden = false;
      $("#loginError").hidden = false;
      $("#loginError").textContent = e.message;
    } else show(false);
  }
}

$("#signin").addEventListener("click", async () => {
  try {
    await api("/api/v1/admin/login", { method: "POST", json: { token: $("#token").value } });
    $("#token").value = "";
    toast("Signed in");
    check();
  } catch (e) {
    $("#loginError").hidden = false;
    $("#loginError").textContent = e.message;
  }
});
$("#token").addEventListener("keydown", (e) => e.key === "Enter" && $("#signin").click());

document.querySelectorAll('[role="tab"]').forEach((t) =>
  t.addEventListener("click", () => {
    document
      .querySelectorAll('[role="tab"]')
      .forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
  }),
);

async function loadJobs() {
  const d = await api("/api/v1/jobs");
  $("#jobs tbody").innerHTML =
    d.items
      .map(
        (j) =>
          `<tr data-id="${esc(j.id)}"><td>${esc(j.kind)}</td><td><span class="arag-chip ${({ succeeded: "ok", failed: "danger", cancelled: "warn" })[j.status] ?? "info"}">${esc(j.status)}</span></td><td class="small muted">${esc(j.stage ?? "")}</td><td class="small muted">${esc(j.createdAt.slice(11, 19))}</td></tr>`,
      )
      .join("") || '<tr><td colspan="4" class="muted">No jobs yet.</td></tr>';
  $("#jobs")
    .querySelectorAll("tr[data-id]")
    .forEach((r) =>
      r.addEventListener("click", async () => {
        const j = await api(`/api/v1/jobs/${r.dataset.id}`);
        $("#jobDetail").job = j;
        $("#jobJson").data = j;
      }),
    );
}
$("#reloadJobs").addEventListener("click", loadJobs);
$("#level").addEventListener("change", (e) => {
  $("#log").setAttribute("level", e.target.value);
  $("#log").load();
});
$("#contains").addEventListener("change", (e) => {
  $("#log").setAttribute("contains", e.target.value);
  $("#log").load();
});
check();
