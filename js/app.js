// ════════════════════════════════════════
//  APP.JS — главный файл запуска
//  Собирает все модули вместе
// ════════════════════════════════════════

import { auth }                        from "./firebase.js";
import { setUid, getTasks, getIdeas,
         getDiary, deleteTask, deleteIdea,
         deleteDiaryEntry, deleteProject,
         deleteGoal, deleteTemplate,
         toggleTask, esc, isOv, fdt }  from "./db.js";
import { initModal, toast, addSubRow,
         setPriority }                 from "./modal.js";
import { switchTab, registerTab,
         openSidebar, closeSidebar }   from "./router.js";
import { openCal, closeCal,
         initCalendar }                from "./calendar.js";
import { openNewModal, editTaskModal,
         editIdeaModal, editDiaryModal,
         buildTaskModal }              from "./forms.js";
import { initStorage }                 from "./storage.js";
import { initDashboard }               from "./tabs/dashboard.js";
import { initPlan, renderPlan }        from "./tabs/plan.js";
import { initGoals, renderGoals }      from "./tabs/goals.js";
import { initIdeas, renderIdeas }      from "./tabs/ideas.js";
import { initDiary, renderDiary }      from "./tabs/diary.js";
import { saveWeekGoal }                from "./db.js";
import { MONTHS }                      from "./utils.js";

import {
  GoogleAuthProvider, OAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const $ = id => document.getElementById(id);

// Определяем режим: PWA standalone или обычный браузер
const isPWA = () => window.matchMedia("(display-mode: standalone)").matches
                 || window.navigator.standalone === true;

// ════════════════════════════════════════
//  WINDOW GLOBALS
//  (нужны для inline onclick в HTML)
// ════════════════════════════════════════
window.openNewModal = openNewModal;
window.openCal      = openCal;
window.closeCal     = closeCal;
window.switchTab    = switchTab;
window.editTask     = editTaskModal;
window.editIdea     = editIdeaModal;
window.editDiary    = editDiaryModal;
window.toggleTask   = async id => { await toggleTask(id); refreshAll(); };
window._esc         = esc;
window._fdt         = fdt;
window._isOv        = isOv;
window._setPri      = setPriority;
window._addSub      = (containerId = "sub-list") => addSubRow(containerId);
window._saveWG      = saveWeekGoal;

window._getTasks    = getTasks;
window._getIdeas    = getIdeas;
window._getDiary    = getDiary;

window.delItem = async (col, id) => {
  if (!confirm("Удалить?")) return;
  const map = {
    tasks:     deleteTask,
    ideas:     deleteIdea,
    diary:     deleteDiaryEntry,
    projects:  deleteProject,
    goals:     deleteGoal,
    templates: deleteTemplate,
  };
  await map[col]?.(id);
  toast("Удалено");
  refreshAll();
};

window._delTask = async id => {
  if (!confirm("Удалить задачу?")) return;
  await deleteTask(id);
  toast("Задача удалена");
  const { closeModal } = await import("./modal.js");
  closeModal();
  refreshAll();
};

window._refreshAll = refreshAll;

// ════════════════════════════════════════
//  REFRESH — обновляет текущую вкладку
// ════════════════════════════════════════
async function refreshAll() {
  const tab = (await import("./router.js")).curTab;
  if      (tab==="dashboard") { const {renderDashboard}=(await import("./tabs/dashboard.js")); await renderDashboard?.(); }
  else if (tab==="plan")      await renderPlan();
  else if (tab==="goals")     await renderGoals();
  else if (tab==="ideas")     await renderIdeas();
  else if (tab==="diary")     await renderDiary();
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function initApp() {
  initModal();
  initCalendar();
  initStorage(); // инициализация Firebase Storage
  initDashboard();
  initPlan();
  initGoals();
  initIdeas();
  initDiary();

  // Nav tabs
  document.querySelectorAll(".nt").forEach(t =>
    t.addEventListener("click", () => switchTab(t.dataset.tab))
  );

  // Sidebar toggle
  $("burger")?.addEventListener("click", openSidebar);
  $("sb-ov")?.addEventListener("click",  closeSidebar);

  // ── Тёмная тема ──
  initTheme();

  // New entry button — зависит от текущей вкладки
  async function newForTab() {
    const { curTab } = await import("./router.js");
    const map = { dashboard:"task", plan:"task", goals:"goal", ideas:"idea", diary:"diary" };
    openNewModal(map[curTab] || "task", null, null, curTab);
  }
  $("sb-new")?.addEventListener("click", () => { closeSidebar(); newForTab(); });
  $("tb-new")?.addEventListener("click", newForTab);
}

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
$("btn-g").onclick = async () => {
  try {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    if (isPWA()) {
      // В PWA режиме popup не работает — используем redirect
      await signInWithRedirect(auth, p);
    } else {
      await signInWithPopup(auth, p);
    }
  } catch(e) {
    const m = {
      "auth/unauthorized-domain": `Домен не авторизован!\nДобавьте skudatin-lang.github.io\nв Firebase Console → Authentication → Authorized domains`,
      "auth/popup-blocked":       "Разрешите всплывающие окна в браузере.",
      "auth/popup-closed-by-user":"Вход отменён.",
    };
    alert(m[e.code] || ("Ошибка: " + e.code));
  }
};

$("btn-y").onclick = async () => {
  try {
    const p = new OAuthProvider("yandex.com");
    if (isPWA()) {
      await signInWithRedirect(auth, p);
    } else {
      await signInWithPopup(auth, p);
    }
  } catch(e) {
    alert(e.code==="auth/unauthorized-domain"
      ? "Добавьте skudatin-lang.github.io в Firebase Authorized domains."
      : "Яндекс: " + e.code);
  }
};

$("btn-logout").onclick = async () => {
  if (confirm("Выйти из аккаунта?")) await signOut(auth);
};

onAuthStateChanged(auth, async user => {
  // Обрабатываем возврат после redirect авторизации (PWA)
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) user = result.user;
  } catch(e) {
    if (e.code !== "auth/no-current-user") {
      alert("Ошибка авторизации: " + e.code);
    }
  }

  if (user) {
    setUid(user.uid);
    $("sb-un").textContent = user.displayName || "Пользователь";
    $("sb-ue").textContent = user.email || "";
    const av = $("sb-av");
    av.innerHTML = user.photoURL
      ? `<img src="${user.photoURL}" alt=""/>`
      : (user.displayName || "U")[0].toUpperCase();
    const mn = new Date();
    $("sb-mo").textContent = MONTHS[mn.getMonth()].toUpperCase() + " " + mn.getFullYear();
    $("s-auth").classList.remove("on");
    $("s-app").classList.add("on");
    initApp();
    await switchTab("dashboard");
  } else {
    $("s-app").classList.remove("on");
    $("s-auth").classList.add("on");
  }
});

// ════════════════════════════════════════
//  ТЁМНАЯ ТЕМА
// ════════════════════════════════════════
function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("lc-theme") || "light";
  applyTheme(saved);

  // Кнопка в десктопном топбаре
  const desktopBtn = $("theme-toggle");
  if (desktopBtn) desktopBtn.onclick = toggleTheme;

  // Кнопка в мобильном навбаре
  const mobileBtn = $("nav-theme-btn");
  if (mobileBtn) mobileBtn.onclick = toggleTheme;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    const b1 = document.getElementById("theme-toggle");
    const b2 = document.getElementById("nav-theme-btn");
    if (b1) b1.textContent = "☀️";
    if (b2) b2.textContent = "☀️";
  } else {
    root.removeAttribute("data-theme");
    const b1 = document.getElementById("theme-toggle");
    const b2 = document.getElementById("nav-theme-btn");
    if (b1) b1.textContent = "🌙";
    if (b2) b2.textContent = "🌙";
  }
}

function toggleTheme() {
  const isDark = document.documentElement.hasAttribute("data-theme");
  const next = isDark ? "light" : "dark";
  localStorage.setItem("lc-theme", next);
  applyTheme(next);
}
window.toggleTheme = toggleTheme;