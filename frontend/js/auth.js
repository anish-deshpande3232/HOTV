/* =========================================================
   auth.js — Session management & role-based routing
   ========================================================= */

function login(role) {
  localStorage.setItem("role", role);
  localStorage.setItem("loginTime", Date.now());
  const names = { farmer:"Rajesh Kumar", company:"AgroFresh Ltd.", lab:"BioTest Labs", admin:"Platform Admin" };
  localStorage.setItem("userName", names[role] || role);
  window.location.href = role + ".html";
}

function logout() {
  localStorage.removeItem("role");
  localStorage.removeItem("userName");
  localStorage.removeItem("loginTime");
  window.location.href = "login.html";
}

function getRole()     { return localStorage.getItem("role"); }
function getUserName() { return localStorage.getItem("userName") || "User"; }

function requireRole(allowed) {
  const r = getRole();
  if (!r || (allowed && !allowed.includes(r))) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/* Populate sidebar user info */
function populateSidebarUser() {
  const role = getRole();
  const name = getUserName();
  const el   = (id) => document.getElementById(id);
  if (el("sb-name"))   el("sb-name").textContent   = name;
  if (el("sb-role"))   el("sb-role").textContent   = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
  if (el("sb-avatar")) el("sb-avatar").textContent = name.charAt(0).toUpperCase();
}
