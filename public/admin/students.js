const statusEl = document.getElementById("status");
const bodyEl = document.getElementById("studentsBody");
const form = document.getElementById("studentForm");
const filterClassEl = document.getElementById("filterClass");
const reloadBtn = document.getElementById("reloadBtn");

const setStatus = (text, type = "") => {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
};

const loadStudents = async () => {
  const cls = filterClassEl.value.trim();
  const query = cls ? `?className=${encodeURIComponent(cls)}` : "";
  const { rows } = await window.adminApp.adminFetch(`/api/admin/students${query}`);
  bodyEl.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.student_number}</td>
      <td>${r.class_name}</td>
      <td>${window.adminApp.canEdit() ? `<button data-student="${r.student_number}" type="button">Verwijderen</button>` : "-"}</td>
    `;
    bodyEl.appendChild(tr);
  });
  setStatus(`${rows.length} leerlingen geladen.`, "ok");
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.adminApp.canEdit()) {
    setStatus("Alleen admin mag wijzigen.", "error");
    return;
  }
  try {
    await window.adminApp.adminFetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: document.getElementById("studentNumber").value.trim(),
        className: document.getElementById("className").value.trim()
      })
    });
    setStatus("Leerling opgeslagen.", "ok");
    await loadStudents();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

reloadBtn.addEventListener("click", () => loadStudents().catch((e) => setStatus(e.message, "error")));

bodyEl.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const student = target.getAttribute("data-student");
  if (!student) return;
  if (!window.adminApp.canEdit()) return;
  try {
    await window.adminApp.adminFetch(`/api/admin/students?studentNumber=${encodeURIComponent(student)}`, {
      method: "DELETE"
    });
    setStatus(`Leerling ${student} verwijderd.`, "ok");
    await loadStudents();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  loadStudents().catch((e) => setStatus(e.message, "error"));
});
