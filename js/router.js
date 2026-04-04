// =============================================
//  ROUTER — переключение модулей
// =============================================

const moduleNames = {
  dashboard: "Главная",
  plan:      "План дня",
  projects:  "Проекты",
  chaos:     "Место Хаоса",
};

const moduleCallbacks = {};

export function registerModule(id, onActivate) {
  moduleCallbacks[id] = onActivate;
}

export function navigateTo(moduleId) {
  document.querySelectorAll(".module").forEach(m => m.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const view = document.getElementById(`module-${moduleId}`);
  if (view) view.classList.add("active");

  const navItem = document.querySelector(`.nav-item[data-module="${moduleId}"]`);
  if (navItem) navItem.classList.add("active");

  document.getElementById("topbar-title").textContent = moduleNames[moduleId] || moduleId;

  // Clear topbar actions before each module renders
  document.getElementById("topbar-actions").innerHTML = "";

  moduleCallbacks[moduleId]?.();
  closeSidebar();
}

export function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("visible");
}

export function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("visible");
}

// Wire nav clicks
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(item.dataset.module);
  });
});

document.getElementById("topbar-menu").addEventListener("click", openSidebar);
document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);
