// =============================================
//  MODULE: DASHBOARD
// =============================================

import { registerModule, navigateTo } from "../router.js";
import { getStats } from "../db.js";

const container = document.getElementById("module-dashboard");

const DAYS_RU   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const MONTHS_RU = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

function formatToday() {
  const d = new Date();
  return `${DAYS_RU[d.getDay()]}, ${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}
function greetingByTime() {
  const h = new Date().getHours();
  if (h < 5)  return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 17) return "Добрый день";
  return "Добрый вечер";
}

async function render(userName) {
  container.innerHTML = `
    <div class="dashboard-greeting">
      <div class="greeting-date">${formatToday()}</div>
      <div class="greeting-text">${greetingByTime()},<br/><span>${userName || "друг"}</span> 👋</div>
    </div>
    <div id="dash-stats-grid" class="dashboard-grid">
      <div class="dash-tile" style="grid-column:1/-1;opacity:0.5">
        <div class="dash-tile-label">Загрузка...</div>
      </div>
    </div>
    <div style="margin-top:var(--sp-lg)">
      <div class="section-header">
        <span class="section-title">Быстрый переход</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-secondary" style="justify-content:flex-start;gap:10px" onclick="window.xkNav('plan')">
          <span style="color:var(--ochre)">◫</span> Открыть план дня
        </button>
        <button class="btn btn-secondary" style="justify-content:flex-start;gap:10px" onclick="window.xkNav('projects')">
          <span style="color:var(--ochre)">▤</span> Открыть проекты
        </button>
        <button class="btn btn-secondary" style="justify-content:flex-start;gap:10px" onclick="window.xkNav('chaos')">
          <span style="color:var(--ochre)">↯</span> Открыть место хаоса
        </button>
      </div>
    </div>`;

  try {
    const s = await getStats();
    document.getElementById("dash-stats-grid").innerHTML = `
      <div class="dash-tile" data-target="plan">
        <div class="dash-tile-icon">◫</div>
        <div class="dash-tile-label">План дня</div>
        <div class="dash-tile-count">${s.todayTasks} задач сегодня</div>
      </div>
      <div class="dash-tile" data-target="projects">
        <div class="dash-tile-icon">▤</div>
        <div class="dash-tile-label">Проекты</div>
        <div class="dash-tile-count">${s.projects} проектов</div>
      </div>
      <div class="dash-tile" data-target="chaos">
        <div class="dash-tile-icon">↯</div>
        <div class="dash-tile-label">Место Хаоса</div>
        <div class="dash-tile-count">${s.chaosItems} идей</div>
      </div>
      <div class="dash-tile" data-target="projects">
        <div class="dash-tile-icon">✓</div>
        <div class="dash-tile-label">Выполнено</div>
        <div class="dash-tile-count">${s.doneTasks} из ${s.tasks}</div>
      </div>`;
    document.querySelectorAll(".dash-tile[data-target]").forEach(tile => {
      tile.addEventListener("click", () => navigateTo(tile.dataset.target));
    });
  } catch (e) {
    console.error("Stats error:", e);
  }
}

window.xkNav = (module) => navigateTo(module);

export function initDashboard(getUserName) {
  registerModule("dashboard", () => render(getUserName()));
}
