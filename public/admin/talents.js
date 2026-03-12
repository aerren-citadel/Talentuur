const statusEl = document.getElementById("status");
const bodyEl = document.getElementById("talentsBody");
const form = document.getElementById("talentForm");

const setStatus = (text, type = "") => {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
};

const loadTalents = async () => {
  const { rows } = await window.adminApp.adminFetch("/api/admin/talents");
  bodyEl.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.code}</td>
      <td>${r.label}</td>
      <td>${r.is_active ? "Ja" : "Nee"}</td>
      <td>${r.allow_repeat ? "Ja" : "Nee"}</td>
      <td>${r.sort_order}</td>
      <td>${window.adminApp.canEdit() ? `<button data-code="${r.code}" type="button">Inactief zetten</button>` : "-"}</td>
    `;
    bodyEl.appendChild(tr);
  });
  setStatus(`${rows.length} talenturen geladen.`, "ok");
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.adminApp.canEdit()) {
    setStatus("Alleen admin mag wijzigen.", "error");
    return;
  }
  try {
    await window.adminApp.adminFetch("/api/admin/talents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: document.getElementById("code").value.trim(),
        label: document.getElementById("label").value.trim(),
        sortOrder: Number(document.getElementById("sortOrder").value || 0),
        allowRepeat: document.getElementById("allowRepeat").value === "true",
        isActive: document.getElementById("isActive").value === "true"
      })
    });
    setStatus("Talentuur opgeslagen.", "ok");
    await loadTalents();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

bodyEl.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const code = target.getAttribute("data-code");
  if (!code || !window.adminApp.canEdit()) return;
  try {
    await window.adminApp.adminFetch(`/api/admin/talents?code=${encodeURIComponent(code)}`, { method: "DELETE" });
    setStatus(`${code} inactief gezet.`, "ok");
    await loadTalents();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  loadTalents().catch((e) => setStatus(e.message, "error"));
});
