const els = {
  form: document.getElementById("student-form"),
  studentNumber: document.getElementById("studentNumber"),
  periodId: document.getElementById("periodId"),
  choice1: document.getElementById("choice1"),
  choice2: document.getElementById("choice2"),
  choice3: document.getElementById("choice3"),
  choice4: document.getElementById("choice4"),
  status: document.getElementById("status")
};

let currentOptions = [];

const setStatus = (message, type = "") => {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
};

const fetchJSON = async (url, init = {}) => {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Onbekende fout");
  return data;
};

const renderPeriods = async () => {
  const { periods } = await fetchJSON("/api/periods");
  const openPeriods = periods.filter((p) => p.is_open);
  els.periodId.innerHTML = '<option value="">Kies periode...</option>';
  openPeriods.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (${p.school_year}, jaar ${p.year_level}, periode ${p.period_number})`;
    els.periodId.appendChild(option);
  });
};

const buildOptions = (selectedValues = []) => {
  const allSelects = [els.choice1, els.choice2, els.choice3, els.choice4];
  allSelects.forEach((select, index) => {
    const current = selectedValues[index] || "";
    const otherSelected = new Set(selectedValues.filter((v, i) => v && i !== index));
    select.innerHTML = '<option value="">Kies...</option>';
    currentOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.code;
      o.textContent = opt.label + (opt.disabled ? " (al gevolgd)" : "");
      o.disabled = opt.disabled || otherSelected.has(opt.code);
      o.selected = current === opt.code;
      select.appendChild(o);
    });
  });
};

const reloadTalentOptions = async () => {
  const studentNumber = els.studentNumber.value.trim();
  const periodId = els.periodId.value;
  if (!studentNumber || !periodId) return;

  try {
    const { options } = await fetchJSON(
      `/api/student/options?studentNumber=${encodeURIComponent(studentNumber)}&periodId=${encodeURIComponent(periodId)}`
    );
    currentOptions = options;
    const current = [els.choice1.value, els.choice2.value, els.choice3.value, els.choice4.value];
    buildOptions(current);
  } catch (error) {
    setStatus(error.message, "error");
  }
};

const getChoiceValues = () => [els.choice1.value, els.choice2.value, els.choice3.value, els.choice4.value];

[els.choice1, els.choice2, els.choice3, els.choice4].forEach((select) => {
  select.addEventListener("change", () => buildOptions(getChoiceValues()));
});

els.studentNumber.addEventListener("blur", reloadTalentOptions);
els.periodId.addEventListener("change", reloadTalentOptions);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Bezig met opslaan...");

  const payload = {
    studentNumber: els.form.studentNumber.value.trim(),
    firstName: els.form.firstName.value.trim(),
    lastName: els.form.lastName.value.trim(),
    className: els.form.className.value.trim(),
    periodId: Number(els.form.periodId.value),
    choices: getChoiceValues()
  };

  try {
    await fetchJSON("/api/student/choices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setStatus("Je keuzes zijn opgeslagen.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

const init = async () => {
  try {
    await renderPeriods();
    buildOptions([]);
  } catch (error) {
    setStatus(error.message, "error");
  }
};

init();
