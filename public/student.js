const els = {
  loginSection: document.getElementById("login-section"),
  choiceSection: document.getElementById("choice-section"),
  loginForm: document.getElementById("login-form"),
  studentForm: document.getElementById("student-form"),
  loginStudentNumber: document.getElementById("loginStudentNumber"),
  loginClassName: document.getElementById("loginClassName"),
  periodId: document.getElementById("periodId"),
  choice1: document.getElementById("choice1"),
  choice2: document.getElementById("choice2"),
  choice3: document.getElementById("choice3"),
  choice4: document.getElementById("choice4"),
  loginStatus: document.getElementById("login-status"),
  status: document.getElementById("status"),
  sessionLabel: document.getElementById("session-label"),
  logoutBtn: document.getElementById("logout-btn")
};

let currentOptions = [];
let session = null;

const setStatus = (message, type = "") => {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
};

const setLoginStatus = (message, type = "") => {
  els.loginStatus.textContent = message;
  els.loginStatus.className = `status ${type}`.trim();
};

const fetchJSON = async (url, init = {}) => {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Onbekende fout");
  return data;
};

const getChoiceValues = () => [els.choice1.value, els.choice2.value, els.choice3.value, els.choice4.value];

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

const reloadTalentOptions = async () => {
  if (!session) return;
  const periodId = els.periodId.value;
  if (!periodId) return;

  try {
    const { options } = await fetchJSON(
      `/api/student/options?studentNumber=${encodeURIComponent(session.studentNumber)}&className=${encodeURIComponent(session.className)}&periodId=${encodeURIComponent(periodId)}`
    );
    currentOptions = options;
    buildOptions(getChoiceValues());
  } catch (error) {
    setStatus(error.message, "error");
  }
};

const renderSession = () => {
  if (!session) {
    els.loginSection.classList.remove("hidden");
    els.choiceSection.classList.add("hidden");
    els.sessionLabel.textContent = "";
    return;
  }
  els.loginSection.classList.add("hidden");
  els.choiceSection.classList.remove("hidden");
  els.sessionLabel.textContent = `Ingelogd als leerling ${session.studentNumber} (${session.className})`;
};

const setSession = (next) => {
  session = next;
  if (next) {
    sessionStorage.setItem("studentSession", JSON.stringify(next));
  } else {
    sessionStorage.removeItem("studentSession");
  }
  renderSession();
};

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentNumber = els.loginStudentNumber.value.trim();
  const className = els.loginClassName.value.trim();
  if (!studentNumber || !className) {
    setLoginStatus("Vul leerlingnummer en klas in.", "error");
    return;
  }
  setSession({ studentNumber, className });
  setLoginStatus("");
  setStatus("");
  els.periodId.value = "";
  currentOptions = [];
  buildOptions([]);
  await renderPeriods();
});

els.logoutBtn.addEventListener("click", () => {
  setSession(null);
  els.loginStudentNumber.value = "";
  els.loginClassName.value = "";
  setStatus("");
});

[els.choice1, els.choice2, els.choice3, els.choice4].forEach((select) => {
  select.addEventListener("change", () => buildOptions(getChoiceValues()));
});

els.periodId.addEventListener("change", reloadTalentOptions);

els.studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!session) {
    setStatus("Log eerst in.", "error");
    return;
  }
  setStatus("Bezig met opslaan...");

  const payload = {
    studentNumber: session.studentNumber,
    className: session.className,
    periodId: Number(els.periodId.value),
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
  const saved = sessionStorage.getItem("studentSession");
  if (saved) {
    try {
      setSession(JSON.parse(saved));
      await renderPeriods();
      return;
    } catch {
      sessionStorage.removeItem("studentSession");
    }
  }
  renderSession();
};

init().catch((error) => setStatus(error.message, "error"));
