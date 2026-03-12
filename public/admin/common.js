const adminState = {
  role: null
};

const getToken = () => (localStorage.getItem("adminToken") || "").trim();

const setToken = (token) => localStorage.setItem("adminToken", token.trim());

const adminFetch = async (url, init = {}) => {
  const headers = {
    ...(init.headers || {}),
    "x-admin-token": getToken()
  };
  const res = await fetch(url, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Onbekende fout");
  return data;
};

const verifyRole = async () => {
  const { role } = await adminFetch("/api/admin/session");
  adminState.role = role;
  return role;
};

const bindTokenInput = () => {
  const input = document.getElementById("adminToken");
  if (!input) return;
  input.value = getToken();
  input.addEventListener("change", async () => {
    setToken(input.value);
    await updateRoleHint();
  });
};

const updateRoleHint = async () => {
  const hint = document.getElementById("roleHint");
  if (!hint) return;
  hint.textContent = "Controleren...";
  hint.className = "status";
  try {
    const role = await verifyRole();
    hint.textContent = role === "admin" ? "Ingelogd als admin" : "Ingelogd als rooster-coördinator (read-only)";
    hint.className = "status ok";
  } catch {
    adminState.role = null;
    hint.textContent = "Geen geldige login. Plak een geldig token.";
    hint.className = "status error";
  }
};

window.adminApp = {
  adminFetch,
  get role() {
    return adminState.role;
  },
  canEdit() {
    return adminState.role === "admin";
  },
  async init() {
    bindTokenInput();
    await updateRoleHint();
  }
};

window.addEventListener("DOMContentLoaded", () => {
  window.adminApp.init().catch(() => {
    // ignore; message shown in role hint
  });
});
