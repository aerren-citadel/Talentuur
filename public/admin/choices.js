const statusEl = document.getElementById("status");
const periodEl = document.getElementById("periodId");
const sortByEl = document.getElementById("sortBy");
const bodyEl = document.getElementById("choicesBody");
const loadBtn = document.getElementById("loadBtn");
const csvBtn = document.getElementById("csvBtn");

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

const renderRows = () => {
  const sortBy = sortByEl.value;
  const rows = [...rowsCache].sort((a, b) => String(a[sortBy] || "").localeCompare(String(b[sortBy] || "")));
  bodyEl.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.student_number}</td>
      <td>${r.class_name || ""}</td>
      <td>${r.choice1 || ""}</td>
      <td>${r.choice2 || ""}</td>
      <td>${r.choice3 || ""}</td>
      <td>${r.choice4 || ""}</td>
      <td>${r.assigned_label || ""}</td>
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

const exportCsv = () => {
  if (!rowsCache.length) return setStatus("Geen data om te exporteren.", "error");
  const lines = [
    "Leerlingnummer;Klas;1e keuze;2e keuze;3e keuze;4e keuze;Toegewezen"
  ];
  rowsCache.forEach((r) => {
    const vals = [r.student_number, r.class_name || "", r.choice1 || "", r.choice2 || "", r.choice3 || "", r.choice4 || "", r.assigned_label || ""];
    lines.push(vals.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "keuzes-periode.csv";
  a.click();
  URL.revokeObjectURL(url);
};

loadBtn.addEventListener("click", () => loadRows().catch((e) => setStatus(e.message, "error")));
sortByEl.addEventListener("change", renderRows);
csvBtn.addEventListener("click", exportCsv);

window.addEventListener("DOMContentLoaded", () => {
  renderPeriods().catch((e) => setStatus(e.message, "error"));
});
