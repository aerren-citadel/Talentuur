const statusEl = document.getElementById("status");
const periodsBody = document.getElementById("periodsBody");
const periodSelect = document.getElementById("periodId");
const talentList = document.getElementById("talentList");
const form = document.getElementById("periodForm");
const newBtn = document.getElementById("newBtn");

let periods = [];
let talents = [];

const setStatus = (text, type = "") => {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
};

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const renderTalentList = (selected = []) => {
  const selectedSet = new Set(selected);
  talentList.innerHTML = "";
  talents.forEach((t) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.gap = "6px";
    label.style.alignItems = "center";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = t.code;
    input.checked = selectedSet.has(t.code);
    input.style.width = "auto";
    const span = document.createElement("span");
    span.textContent = t.label;
    label.appendChild(input);
    label.appendChild(span);
    talentList.appendChild(label);
  });
};

const renderPeriodSelect = () => {
  periodSelect.innerHTML = '<option value="">Nieuwe periode...</option>';
  periods.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (${p.school_year} Y${p.year_level}P${p.period_number})`;
    periodSelect.appendChild(option);
  });
};

const renderPeriodsTable = () => {
  periodsBody.innerHTML = "";
  periods.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.school_year} / ${p.year_level}</td>
      <td>${p.period_number}</td>
      <td>${p.is_open_now ? "Ja" : "Nee"}</td>
      <td>${p.open_at ? new Date(p.open_at).toLocaleString() : "-"}</td>
      <td>${p.close_at ? new Date(p.close_at).toLocaleString() : "-"}</td>
    `;
    periodsBody.appendChild(tr);
  });
};

const loadData = async () => {
  const [periodRes, talentRes] = await Promise.all([
    window.adminApp.adminFetch("/api/admin/periods"),
    window.adminApp.adminFetch("/api/admin/talents")
  ]);
  periods = periodRes.rows;
  talents = talentRes.rows.filter((t) => t.is_active);
  renderPeriodSelect();
  renderPeriodsTable();
  renderTalentList([]);
};

const fillForm = () => {
  const id = Number(periodSelect.value || 0);
  if (!id) {
    form.reset();
    document.getElementById("isOpen").value = "true";
    renderTalentList([]);
    return;
  }
  const p = periods.find((x) => x.id === id);
  if (!p) return;
  document.getElementById("name").value = p.name;
  document.getElementById("schoolYear").value = p.school_year;
  document.getElementById("yearLevel").value = String(p.year_level);
  document.getElementById("periodNumber").value = String(p.period_number);
  document.getElementById("isOpen").value = String(Boolean(p.is_open));
  document.getElementById("openAt").value = toLocalInput(p.open_at);
  document.getElementById("closeAt").value = toLocalInput(p.close_at);
  renderTalentList(p.available_talents || []);
};

newBtn.addEventListener("click", () => {
  periodSelect.value = "";
  fillForm();
});
periodSelect.addEventListener("change", fillForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.adminApp.canEdit()) {
    setStatus("Alleen admin mag wijzigen.", "error");
    return;
  }
  const availableTalents = Array.from(talentList.querySelectorAll("input:checked")).map((i) => i.value);
  try {
    await window.adminApp.adminFetch("/api/admin/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Number(periodSelect.value || 0),
        name: document.getElementById("name").value.trim(),
        schoolYear: document.getElementById("schoolYear").value.trim(),
        yearLevel: Number(document.getElementById("yearLevel").value),
        periodNumber: Number(document.getElementById("periodNumber").value),
        isOpen: document.getElementById("isOpen").value === "true",
        openAt: document.getElementById("openAt").value || null,
        closeAt: document.getElementById("closeAt").value || null,
        availableTalents
      })
    });
    setStatus("Periode opgeslagen.", "ok");
    await loadData();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  loadData().catch((e) => setStatus(e.message, "error"));
});
