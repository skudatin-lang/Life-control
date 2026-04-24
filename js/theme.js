// ════════════════════════════════════════
//  THEME MODULE
//  js/theme.js
//  Переключение светлой / тёмной темы.
//  Тема сохраняется в localStorage.
// ════════════════════════════════════════

const STORAGE_KEY = "lc-theme";
const DARK        = "dark";
const LIGHT       = "light";

// Применяем тему сразу при загрузке страницы
// (до initTheme), чтобы не было мигания
(function applyOnLoad() {
  const saved = localStorage.getItem(STORAGE_KEY);
  // Также учитываем системные предпочтения пользователя
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? DARK : LIGHT);
  if (theme === DARK) {
    document.documentElement.setAttribute("data-theme", DARK);
  }
})();

// ── Получить текущую тему ──
export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === DARK ? DARK : LIGHT;
}

// ── Установить тему ──
export function setTheme(theme) {
  if (theme === DARK) {
    document.documentElement.setAttribute("data-theme", DARK);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(STORAGE_KEY, theme);
  updateToggleButtons();
}

// ── Переключить тему ──
export function toggleTheme() {
  setTheme(getTheme() === DARK ? LIGHT : DARK);
}

// ── Обновить все кнопки-переключатели на странице ──
function updateToggleButtons() {
  const isDark = getTheme() === DARK;
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.textContent = isDark ? "☀️" : "🌙";
    btn.title       = isDark ? "Светлая тема" : "Тёмная тема";
  });
}

// ── Инициализация: вешаем обработчики на все .theme-toggle ──
export function initTheme() {
  updateToggleButtons();
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", toggleTheme);
  });
}
