// =============================================
//  APP.JS — главный файл запуска
// =============================================

import { setAuthCallbacks, loginWithGoogle, loginWithYandex, logout } from "./auth.js";
import { setCurrentUser } from "./db.js";
import { navigateTo } from "./router.js";
import { initDashboard } from "./modules/dashboard.js";
import { initPlan }      from "./modules/plan.js";
import { initProjects }  from "./modules/projects.js";
import { initChaos }     from "./modules/chaos.js";

let currentUser = null;

// ---- Auth buttons ----
document.getElementById("btn-google-login").addEventListener("click", async () => {
  try { await loginWithGoogle(); }
  catch (e) { alert("Ошибка входа через Google: " + e.message); }
});

document.getElementById("btn-yandex-login").addEventListener("click", async () => {
  try { await loginWithYandex(); }
  catch (e) { alert("Ошибка входа через Яндекс: " + e.message); }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  if (!confirm("Выйти из аккаунта?")) return;
  await logout();
});

// ---- Auth state ----
function onLogin(user) {
  currentUser = user;
  setCurrentUser(user.uid);

  // Update sidebar user info
  document.getElementById("user-name").textContent  = user.displayName || "Пользователь";
  document.getElementById("user-email").textContent = user.email || "";
  const avatarEl = document.getElementById("user-avatar");
  if (user.photoURL) {
    avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar" />`;
  } else {
    avatarEl.textContent = (user.displayName || "U")[0].toUpperCase();
  }

  // Show app, hide auth
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("app-screen").classList.add("active");

  // Init modules
  initDashboard(() => currentUser?.displayName?.split(" ")[0] || "друг");
  initPlan();
  initProjects();
  initChaos();

  // Navigate to dashboard
  navigateTo("dashboard");
}

function onLogout() {
  currentUser = null;
  document.getElementById("app-screen").classList.remove("active");
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("topbar-actions").innerHTML = "";
}

setAuthCallbacks(onLogin, onLogout);
