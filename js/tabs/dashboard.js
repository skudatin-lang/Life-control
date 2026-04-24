// ════════════════════════════════════════
//  TAB: DASHBOARD
//  js/tabs/dashboard.js
// ════════════════════════════════════════

import { registerTab, taskCard } from "../router.js";
import { getStats, getTasks, getDiary, getIdeas, dstr, esc, isOv } from "../db.js";

const MGEN = ["января","февраля","марта","апреля","мая","июня",
              "июля","августа","сентября","октября","ноября","декабря"];
const WD   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function initDashboard() { registerTab("dashboard", renderDashboard); }

// ── Считаем эффективность за текущий месяц ──
async function getEfficiency() {
  const tasks = await getTasks();
  const now   = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const monthTasks = tasks.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  if (!monthTasks.length) return { pct: 0, done: 0, total: 0, overdue: 0 };
  const done    = monthTasks.filter(t => t.done).length;
  const overdue = monthTasks.filter(t => !t.done && isOv(t.deadline)).length;
  // Формула: (выполненные - просроченные*0.5) / всего * 100, min 0
  const raw = Math.max(0, Math.round(((done - overdue * 0.5) / monthTasks.length) * 100));
  return { pct: Math.min(100, raw), done, total: monthTasks.length, overdue };
}

// ── Количество просроченных задач за сегодня ──
async function getTodayOverdue() {
  const tasks = await getTasks();
  const td = dstr(new Date());
  return tasks.filter(t => !t.done && t.date === td && isOv(t.deadline)).length;
}

// ── Рисуем SVG-кружок ──
function effCircle(pct) {
  const r   = 54, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? "var(--grn)" : pct >= 40 ? "var(--go)" : "var(--red)";
  const label = pct >= 70 ? "Отлично" : pct >= 40 ? "Хорошо" : "Растём";
  return `
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--bd)" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="10"
        stroke-dasharray="${dash} ${circ}"
        stroke-dashoffset="${circ / 4}"
        stroke-linecap="round"
        style="transition:stroke-dasharray 0.8s ease"/>
      <text x="${cx}" y="${cy - 8}" text-anchor="middle"
        font-family="var(--fd)" font-size="22" font-weight="700"
        fill="${color}">${pct}%</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle"
        font-family="var(--fb)" font-size="11" fill="var(--tx-l)">${label}</text>
      <text x="${cx}" y="${cy + 26}" text-anchor="middle"
        font-family="var(--fb)" font-size="9" fill="var(--tx-l)">эффективность</text>
    </svg>`;
}

// ── Огоньки просроченных задач ──
function flames(count) {
  if (!count) return `<span class="dash-flames none">🎉 всё в срок</span>`;
  const fires = Math.min(count, 5);
  return `<span class="dash-flames">${"🔥".repeat(fires)}<span class="dash-flames-cnt">${count}</span></span>`;
}

// ── Модальное окно выбора типа записи ──
function openNewEntryPicker() {
  // Создаём оверлей с 3 вариантами
  const ov = document.createElement("div");
  ov.className = "entry-picker-ov";
  ov.innerHTML = `
    <div class="entry-picker-box">
      <div class="ep-ttl">Что добавить?</div>
      <button class="ep-btn ep-task" onclick="window._epPick('task')">
        <span class="ep-ico">📋</span>
        <span class="ep-lbl">Задача / Проект / Цель</span>
        <span class="ep-sub">В планировщик</span>
      </button>
      <button class="ep-btn ep-idea" onclick="window._epPick('idea')">
        <span class="ep-ico">💡</span>
        <span class="ep-lbl">Идея</span>
        <span class="ep-sub">В банк идей</span>
      </button>
      <button class="ep-btn ep-diary" onclick="window._epPick('diary')">
        <span class="ep-ico">📖</span>
        <span class="ep-lbl">Заметка</span>
        <span class="ep-sub">В дневник</span>
      </button>
      <button class="ep-cancel" onclick="document.getElementById('entry-picker-ov').remove()">Отмена</button>
    </div>`;
  ov.id = "entry-picker-ov";
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);

  window._epPick = type => {
    ov.remove();
    if (type === "task") {
      // Показываем вложенный выбор: задача / цель / проект
      const ov2 = document.createElement("div");
      ov2.className = "entry-picker-ov";
      ov2.id = "entry-picker-ov2";
      ov2.innerHTML = `
        <div class="entry-picker-box">
          <div class="ep-ttl">Что именно?</div>
          <button class="ep-btn" onclick="document.getElementById('entry-picker-ov2').remove();window.openNewModal('task',null,null,'dashboard')">
            <span class="ep-ico">✅</span>
            <span class="ep-lbl">Задача</span>
            <span class="ep-sub">Конкретное дело</span>
          </button>
          <button class="ep-btn" onclick="document.getElementById('entry-picker-ov2').remove();window.openNewModal('goal',null,null,'dashboard')">
            <span class="ep-ico">🎯</span>
            <span class="ep-lbl">Цель</span>
            <span class="ep-sub">Долгосрочная цель</span>
          </button>
          <button class="ep-btn" onclick="document.getElementById('entry-picker-ov2').remove();window.openNewModal('project',null,null,'dashboard')">
            <span class="ep-ico">📁</span>
            <span class="ep-lbl">Проект</span>
            <span class="ep-sub">Группа задач</span>
          </button>
          <button class="ep-cancel" onclick="document.getElementById('entry-picker-ov2').remove()">Назад</button>
        </div>`;
      ov2.addEventListener("click", e => { if (e.target === ov2) ov2.remove(); });
      document.body.appendChild(ov2);
    } else {
      window.openNewModal(type, null, null, "dashboard");
    }
  };
}
window._openNewEntryPicker = openNewEntryPicker;

// ════════════════ RENDER ════════════════
export async function renderDashboard() {
  const el  = document.getElementById("dash-body");
  const sb  = document.getElementById("sb-body");
  const s   = await getStats();
  const eff = await getEfficiency();
  const ovd = await getTodayOverdue();

  const d     = new Date(), h = d.getHours();
  const gr    = h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 17 ? "Добрый день" : "Добрый вечер";
  const fname = (document.getElementById("sb-un")?.textContent || "").split(" ")[0] || "друг";
  const mo    = MONTHS_UPPER[d.getMonth()];

  // ── SIDEBAR ──
  sb.innerHTML = `
    <div class="dsb-profile">
      <div class="dsb-greeting">${gr},</div>
      <div class="dsb-name">${esc(fname)}</div>
      <div class="dsb-date">${WD[d.getDay()]}, ${d.getDate()} ${MGEN[d.getMonth()]}</div>
      <div class="dsb-flames">${flames(ovd)}</div>
    </div>

    <div class="dsb-eff-wrap" onclick="window.switchTab('plan')" title="Открыть план дня">
      <div class="dsb-eff-lbl">Эффективность месяца</div>
      ${effCircle(eff.pct)}
      <div class="dsb-eff-sub">${eff.done} из ${eff.total} задач · ${eff.overdue} просрочено</div>
      <div class="dsb-eff-hint">↗ план дня</div>
    </div>

    <button class="dsb-new-btn" onclick="window._openNewEntryPicker()">✦ Новая запись</button>`;

  // ── MAIN PANEL ──
  el.innerHTML = `
    <div class="dash-grid">
      <div class="dash-tile" onclick="window.switchTab('plan')">
        <div class="dt-ico">📋</div>
        <div class="dt-lbl">Задачи сегодня</div>
        <div class="dt-val">${s.todayOpen} открытых · ${s.todayDone} готово</div>
      </div>
      <div class="dash-tile" onclick="window.switchTab('goals')">
        <div class="dt-ico">🎯</div>
        <div class="dt-lbl">Цели</div>
        <div class="dt-val">${s.goals.length} целей</div>
      </div>
      <div class="dash-tile" onclick="window.switchTab('ideas')">
        <div class="dt-ico">💡</div>
        <div class="dt-lbl">Идеи</div>
        <div class="dt-val">${s.ideas.length} записей</div>
      </div>
      <div class="dash-tile" onclick="window.switchTab('diary')">
        <div class="dt-ico">📖</div>
        <div class="dt-lbl">Дневник</div>
        <div class="dt-val">${s.diary.length} записей</div>
      </div>
    </div>

    ${s.overdue ? `<div class="dash-overdue-banner">⚠️ Просрочено задач: ${s.overdue}</div>` : ""}

    <div class="sec-lbl">Задачи на сегодня</div>
    ${s.todayTasks.length
      ? s.todayTasks.map(t => taskCard(t, s.goals, [])).join("")
      : '<div class="empty"><div class="ei">📋</div><p>На сегодня задач нет</p></div>'}

    <button class="fab" onclick="window._openNewEntryPicker()">+</button>`;
}

// Константа месяцев заглавными (для sb-mo, уже используется в app.js)
const MONTHS_UPPER = ["ЯНВАРЬ","ФЕВРАЛЬ","МАРТ","АПРЕЛЬ","МАЙ","ИЮНЬ",
                      "ИЮЛЬ","АВГУСТ","СЕНТЯБРЬ","ОКТЯБРЬ","НОЯБРЬ","ДЕКАБРЬ"];
