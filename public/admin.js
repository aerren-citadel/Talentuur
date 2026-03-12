const els = {
  adminToken: document.getElementById("adminToken"),
  periodSelect: document.getElementById("periodSelect"),
  periodName: document.getElementById("periodName"),
  schoolYear: document.getElementById("schoolYear"),
  yearLevel: document.getElementById("yearLevel"),
  periodNumber: document.getElementById("periodNumber"),
  isOpen: document.getElementById("isOpen"),
  talentCheckboxes: document.getElementById("talentCheckboxes"),
  savePeriod: document.getElementById("savePeriod"),
  newPeriod: document.getElementById("newPeriod"),
  loadOverview: document.getElementById("loadOverview"),
  exportCsv: document.getElementById("exportCsv"),
  overviewTableBody: document.querySelector("#overviewTable tbody"),
  status: document.getElementById("status")
};

let periods = [];
let talents = [];
let overviewRows = [];

const setStatus = (message, type = "") => {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
};

const fetchJSON = async (url, init = {}) => {
  const token = els.adminToken.value.trim();
  const headers = {
    ...(init.headers || {}),
    "x-admin-token": token
  };
  const res = await fetch(url, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Onbekende fout");
  return data;
};

const renderPeriodSelect = () => {
  els.periodSelect.innerHTML = '<option value="">Nieuwe periode...</option>';
  periods.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (${p.school_year}, jaar ${p.year_level}, P${p.period_number})`;
    els.periodSelect.appendChild(option);
  });
};

const renderTalentCheckboxes = (selected = []) => {
  const selectedSet = new Set(selected);
  els.talentCheckboxes.innerHTML = "";
  talents.forEach((t) => {
    if (!t.is_active) return;
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.marginBottom = "4px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = t.code;
    checkbox.checked = selectedSet.has(t.code);
    checkbox.style.width = "auto";
    const text = document.createElement("span");
    text.textContent = t.label;
    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    els.talentCheckboxes.appendChild(wrapper);
  });
};

const getSelectedTalentCodes = () => {
  return Array.from(els.talentCheckboxes.querySelectorAll("input[type='checkbox']:checked")).map((i) => i.value);
};

const loadPeriodIntoForm = () => {
  const id = Number(els.periodSelect.value);
  if (!id) {
    els.periodName.value = "";
    els.schoolYear.value = "";
    els.yearLevel.value = "1";
    els.periodNumber.value = "1";
    els.isOpen.value = "true";
    renderTalentCheckboxes([]);
    return;
  }

  const period = periods.find((p) => p.id === id);
  if (!period) return;
  els.periodName.value = period.name;
  els.schoolYear.value = period.school_year;
  els.yearLevel.value = String(period.year_level);
  els.periodNumber.value = String(period.period_number);
  els.isOpen.value = String(period.is_open);
  renderTalentCheckboxes(period.available_talents || []);
};

const loadData = async () => {
  const [periodResult, talentResult] = await Promise.all([fetch("/api/periods"), fetch("/api/talents")]);
  periods = (await periodResult.json()).periods || [];
  talents = (await talentResult.json()).talents || [];
  renderPeriodSelect();
  loadPeriodIntoForm();
};

const savePeriod = async () => {
  const payload = {
    id: Number(els.periodSelect.value || 0),
    name: els.periodName.value.trim(),
    schoolYear: els.schoolYear.value.trim(),
    yearLevel: Number(els.yearLevel.value),
    periodNumber: Number(els.periodNumber.value),
    isOpen: els.isOpen.value === "true",
    availableTalents: getSelectedTalentCodes()
  };
  await fetchJSON("/api/admin/periods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  setStatus("Periode opgeslagen.", "ok");
  await loadData();
};

const renderOverview = () => {
  els.overviewTableBody.innerHTML = "";
  overviewRows.forEach((row) => {
    const tr = document.createElement("tr");
    const assignedOptions = talents
      .filter((t) => t.is_active)
      .map((t) => `<option value="${t.code}" ${row.assigned_talent_code === t.code ? "selected" : ""}>${t.label}</option>`)
      .join("");

    tr.innerHTML = `
      <td>${row.student_number}</td>
      <td>${row.first_name} ${row.last_name}</td>
      <td>${row.class_name}</td>
      <td>${row.choice1 || ""}</td>
      <td>${row.choice2 || ""}</td>
      <td>${row.choice3 || ""}</td>
      <td>${row.choice4 || ""}</td>
      <td>
        <select data-role="assigned" data-student="${row.student_number}">
          <option value="">Kies...</option>
          ${assignedOptions}
        </select>
      </td>
      <td><button type="button" data-role="save-assignment" data-student="${row.student_number}">Opslaan</button></td>
    `;
    els.overviewTableBody.appendChild(tr);
  });
};

const loadOverview = async () => {
  const periodId = Number(els.periodSelect.value);
  if (!periodId) throw new Error("Kies eerst een periode.");
  const { rows } = await fetchJSON(`/api/admin/overview?periodId=${periodId}`);
  overviewRows = rows;
  renderOverview();
  setStatus(`Overzicht geladen (${rows.length} leerlingen).`, "ok");
};

const downloadCsv = () => {
  if (!overviewRows.length) {
    setStatus("Laad eerst een overzicht.", "error");
    return;
  }

  const header = ["Leerlingnr", "Voornaam", "Achternaam", "Klas", "1e", "2e", "3e", "4e", "Toegewezen"];
  const lines = [header.join(";")];
  overviewRows.forEach((r) => {
    const values = [
      r.student_number,
      r.first_name,
      r.last_name,
      r.class_name,
      r.choice1 || "",
      r.choice2 || "",
      r.choice3 || "",
      r.choice4 || "",
      r.assigned_label || ""
    ];
    lines.push(values.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "talentuur-overzicht.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const saveAssignment = async (studentNumber, assignedTalentCode) => {
  const periodId = Number(els.periodSelect.value);
  if (!periodId) throw new Error("Kies eerst een periode.");
  if (!assignedTalentCode) throw new Error("Kies een talentuur om toe te wijzen.");

  await fetchJSON("/api/admin/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentNumber,
      periodId,
      assignedTalentCode,
      assignedBy: "talentuurcoordinator"
    })
  });
  setStatus(`Toewijzing opgeslagen voor ${studentNumber}.`, "ok");
  await loadOverview();
};

els.adminToken.value = localStorage.getItem("adminToken") || "";
els.adminToken.addEventListener("change", () => localStorage.setItem("adminToken", els.adminToken.value.trim()));
els.periodSelect.addEventListener("change", loadPeriodIntoForm);
els.newPeriod.addEventListener("click", () => {
  els.periodSelect.value = "";
  loadPeriodIntoForm();
});
els.savePeriod.addEventListener("click", async () => {
  try {
    await savePeriod();
  } catch (error) {
    setStatus(error.message, "error");
  }
});
els.loadOverview.addEventListener("click", async () => {
  try {
    await loadOverview();
  } catch (error) {
    setStatus(error.message, "error");
  }
});
els.exportCsv.addEventListener("click", downloadCsv);
els.overviewTableBody.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.role !== "save-assignment") return;
  const student = target.dataset.student;
  const row = target.closest("tr");
  const select = row ? row.querySelector("select[data-role='assigned']") : null;
  const assignedTalentCode = select ? select.value : "";
  try {
    await saveAssignment(student, assignedTalentCode);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

loadData().catch((error) => setStatus(error.message, "error"));
