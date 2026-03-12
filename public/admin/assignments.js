const statusEl = document.getElementById("status");
const periodEl = document.getElementById("periodId");
const bodyEl = document.getElementById("assignBody");
const loadBtn = document.getElementById("loadBtn");

let talents = [];
let rowsCache = [];

const setStatus = (text, type = "") => {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
};

const renderPeriods = async () => {
  const { rows } = await window.adminApp.adminFetch("/api/admin/periods");
  periodEl.innerHTML = '<option value="">Kies periode...</option>';
  rows.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (${p.school_year}, jaar ${p.year_level}, P${p.period_number})`;
    periodEl.appendChild(option);
  });
};

const loadTalents = async () => {
  const { rows } = await window.adminApp.adminFetch("/api/admin/talents");
  talents = rows.filter((t) => t.is_active);
};

const renderRows = () => {
  bodyEl.innerHTML = "";
  rowsCache.forEach((r) => {
    const options = talents
      .map((t) => `<option value="${t.code}" ${r.assigned_talent_code === t.code ? "selected" : ""}>${t.label}</option>`)
      .join("");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.student_number}</td>
      <td>${r.class_name || ""}</td>
      <td>${r.choice1 || ""}</td>
      <td>${r.choice2 || ""}</td>
      <td>${r.choice3 || ""}</td>
      <td>${r.choice4 || ""}</td>
      <td><select data-student="${r.student_number}" ${window.adminApp.canEdit() ? "" : "disabled"}><option value="">Kies...</option>${options}</select></td>
      <td>${window.adminApp.canEdit() ? `<button data-save="${r.student_number}" type="button">Opslaan</button>` : "-"}</td>
    `;
    bodyEl.appendChild(tr);
  });
};

const loadRows = async () => {
  const periodId = Number(periodEl.value);
  if (!periodId) throw new Error("Kies eerst een periode.");
  const { rows } = await window.adminApp.adminFetch(`/api/admin/overview?periodId=${periodId}`);
  rowsCache = rows;
  renderRows();
  setStatus(`${rows.length} regels geladen.`, "ok");
};

bodyEl.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const student = target.getAttribute("data-save");
  if (!student || !window.adminApp.canEdit()) return;
  const row = target.closest("tr");
  const select = row ? row.querySelector("select") : null;
  const assignedTalentCode = select ? select.value : "";
  if (!assignedTalentCode) {
    setStatus("Kies eerst een talentuur.", "error");
    return;
  }
  try {
    await window.adminApp.adminFetch("/api/admin/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: student,
        periodId: Number(periodEl.value),
        assignedTalentCode,
        assignedBy: "admin-manueel"
      })
    });
    setStatus(`Toewijzing opgeslagen voor ${student}.`, "ok");
    await loadRows();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

loadBtn.addEventListener("click", () => loadRows().catch((e) => setStatus(e.message, "error")));

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await Promise.all([renderPeriods(), loadTalents()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
});
