// ════════════════════════════════════════
//  TAB: DASHBOARD — новый дизайн
//  js/tabs/dashboard.js
// ════════════════════════════════════════

import { registerTab, taskCard } from "../router.js";
import { getStats, esc, getTasks, dstr, getInbox } from "../db.js";

const MGEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WD   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function initDashboard() { registerTab("dashboard", renderDashboard); }

// ── Напоминания за 24ч ──
async function getReminders() {
  const tasks = await getTasks();
  const now   = new Date();
  return tasks.filter(t => {
    if (!t.reminder || t.done) return false;
    const rd   = t.reminder.toDate ? t.reminder.toDate() : new Date(t.reminder);
    const diff = (rd - now) / (1000 * 3600);
    return diff <= 24 && diff >= -1;
  }).slice(0, 5);
}

// ── Streaks ──
async function getStreaks() {
  const tasks   = await getTasks();
  const parents = tasks.filter(t => !t.parentId && t.recurrence && t.recurrence.type !== "none");
  const result  = [];
  for (const p of parents) {
    const dates = tasks.filter(c => c.parentId === p.id && c.done).map(c => c.date).filter(Boolean).sort().reverse();
    if (!dates.length) continue;
    let streak = 0;
    const d = new Date(); d.setHours(0,0,0,0);
    for (const date of dates) {
      if (dstr(d) === date) { streak++; d.setDate(d.getDate()-1); } else break;
    }
    if (streak >= 2) result.push({ title: p.title, streak });
  }
  return result.sort((a,b) => b.streak - a.streak).slice(0,3);
}

// ── Эффективность: взвешенный % (high×3, med×1) ──
function calcEfficiency(tasks) {
  const w = { high: 3, med: 1, low: 1 };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTasks = tasks.filter(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt || 0);
    return d >= monthStart;
  });
  if (!monthTasks.length) return 0;
  const total = monthTasks.reduce((s, t) => s + (w[t.priority] || 1), 0);
  const done  = monthTasks.filter(t => t.done).reduce((s, t) => s + (w[t.priority] || 1), 0);
  return total ? Math.round(done / total * 100) : 0;
}

// ── SVG кольцо прогресса ──
function progressRing(pct, size, stroke, color) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - pct / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}"
      fill="none" stroke="var(--bd)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}"
      fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${circ}" stroke-dashoffset="${fill}"
      stroke-linecap="round"
      transform="rotate(-90 ${size/2} ${size/2})"
      style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

export async function renderDashboard() {
  const el = document.getElementById("dash-body");
  if (!el) return;

  const [s, reminders, streaks, inbox] = await Promise.all([
    getStats(),
    getReminders(),
    getStreaks(),
    getInbox().catch(() => []),
  ]);

  const d      = new Date(), h = d.getHours();
  const gr     = h<5?"Доброй ночи":h<12?"Доброе утро":h<17?"Добрый день":"Добрый вечер";
  const fname  = (document.getElementById("sb-un")?.textContent||"").split(" ")[0]||"друг";

  // Метрики месяца
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTasks = s.tasks.filter(t => {
    const cd = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt||0);
    return cd >= monthStart;
  });
  const monthPlanned = monthTasks.length;
  const monthDone    = monthTasks.filter(t => t.done).length;
  const efficiency   = calcEfficiency(s.tasks);

  // Задачи сегодня для кольца
  const todayOpen = s.todayTasks.filter(t => !t.done);
  const todayDone = s.todayTasks.filter(t =>  t.done);
  const total     = s.todayTasks.length;
  const pct       = total ? Math.round(todayDone.length / total * 100) : 0;

  // Цвет кольца
  const ringColor = pct >= 80 ? "var(--grn)" : pct >= 40 ? "var(--go)" : "var(--red)";

  // ── Показана ли панель задач ──
  const listId = "dash-task-list";

  el.innerHTML = `
<div class="dash-layout">

  <!-- ═══ ЛЕВАЯ КОЛОНКА ═══ -->
  <div class="dash-left">

    <!-- Приветствие -->
    <div class="dash-greet">
      <div class="dg-date">${WD[d.getDay()]}, ${d.getDate()} ${MGEN[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="dg-hello">${gr}, <span>${esc(fname)}</span></div>
    </div>

    <!-- Просроченные — огоньки -->
    ${s.overdue ? `
    <div class="dash-overdue" onclick="window.switchTab('plan')">
      ${"🔥".repeat(Math.min(s.overdue, 5))}
      <span>${s.overdue} просроченных</span>
    </div>` : ""}

    <!-- Кольцо прогресса -->
    <div class="dash-ring-wrap" id="dash-ring-btn" onclick="toggleDashTasks()">
      <div class="dash-ring-svg">${progressRing(pct, 160, 12, ringColor)}</div>
      <div class="dash-ring-center">
        <div class="dash-ring-pct">${pct}%</div>
        <div class="dash-ring-sub">${todayDone.length} из ${total}</div>
      </div>
    </div>
    <div class="dash-ring-label">выполнить сегодня</div>

    <!-- Список задач (скрытый) -->
    <div id="${listId}" class="dash-task-panel hidden">
      ${total === 0
        ? `<div class="empty" style="padding:20px 0"><div class="ei">📋</div><p>На сегодня задач нет</p></div>`
        : todayOpen.map(t => taskCard(t, s.goals, [])).join("") +
          (todayDone.length ? `<div class="sec-lbl" style="margin-top:10px">Выполнено</div>` +
            todayDone.map(t => taskCard(t, s.goals, [])).join("") : "")}
    </div>

    <!-- Кнопка — банк идей -->
    <button class="dash-idea-btn" onclick="window.quickCapture()">
      + Добавить идею
    </button>

  </div>

  <!-- ═══ ПРАВАЯ КОЛОНКА ═══ -->
  <div class="dash-right">

    <!-- 4 плитки метрик -->
    <div class="dash-metrics">
      <div class="dash-metric" onclick="window.switchTab('plan')">
        <div class="dm-ico">📋</div>
        <div class="dm-val">${monthPlanned}</div>
        <div class="dm-lbl">запланировано</div>
      </div>
      <div class="dash-metric" onclick="window.switchTab('plan')">
        <div class="dm-ico">✅</div>
        <div class="dm-val">${monthDone}</div>
        <div class="dm-lbl">выполнено</div>
      </div>
      <div class="dash-metric" onclick="toggleInboxPanel()">
        <div class="dm-ico">💡</div>
        <div class="dm-val">${inbox.length}</div>
        <div class="dm-lbl">банк идей</div>
        ${inbox.length ? `<div class="dm-badge">${inbox.length}</div>` : ""}
      </div>
      <div class="dash-metric">
        <div class="dm-ico">⚡</div>
        <div class="dm-val">${efficiency}%</div>
        <div class="dm-lbl">эффективность</div>
      </div>
    </div>

    <!-- Банк идей (раскрывается) -->
    <div id="dash-inbox-panel" class="dash-inbox-panel hidden">
      <div class="sec-lbl" style="margin-bottom:8px">💡 Банк идей</div>
      ${inbox.length === 0
        ? `<p style="font-size:12px;color:var(--tx-l)">Пусто — добавьте первую идею</p>`
        : inbox.map(item => `
          <div class="inbox-item">
            <span class="inbox-txt">${esc(item.text||"—")}</span>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="ib" title="В задачу"
                onclick="window._processInbox('${item.id}',${JSON.stringify(item.text||"")})">→</button>
              <button class="ib del" title="Удалить"
                onclick="window._dismissInbox('${item.id}')">✕</button>
            </div>
          </div>`).join("")}
    </div>

    <!-- Reminders -->
    ${reminders.length ? `
    <div class="sec-lbl">🔔 Напоминания</div>
    ${reminders.map(t => taskCard(t, s.goals, [], {clickable:true})).join("")}
    <div class="sec-div"></div>` : ""}

    <!-- Streaks -->
    ${streaks.length ? `
    <div class="sec-lbl">🔥 Серии</div>
    <div class="streak-list">
      ${streaks.map(s => `
        <div class="streak-item">
          <span class="streak-num">${s.streak}</span>
          <span class="streak-title">${esc(s.title)}</span>
        </div>`).join("")}
    </div>
    <div class="sec-div"></div>` : ""}

    <!-- Выполнено сегодня -->
    ${todayDone.length ? `
    <div class="sec-lbl">✓ Выполнено сегодня (${todayDone.length})</div>
    ${todayDone.map(t => taskCard(t, s.goals, [])).join("")}` : ""}

    <!-- Цели (плитки) -->
    <div class="sec-div"></div>
    <div class="dash-goals-grid">
      <div class="dash-goal-tile" onclick="window.switchTab('goals')">
        <div class="dt-ico">🎯</div>
        <div class="dt-lbl">Цели</div>
        <div class="dt-val">${s.goals.length}</div>
      </div>
      <div class="dash-goal-tile" onclick="window.switchTab('ideas')">
        <div class="dt-ico">💭</div>
        <div class="dt-lbl">Идеи</div>
        <div class="dt-val">${s.ideas.length}</div>
      </div>
      <div class="dash-goal-tile" onclick="window.switchTab('diary')">
        <div class="dt-ico">📖</div>
        <div class="dt-lbl">Дневник</div>
        <div class="dt-val">${s.diary.length}</div>
      </div>
    </div>

  </div>
</div>

<button class="fab" onclick="window.openNewModal('task',null,null,'dashboard')">+</button>`;

  // Тогл списка задач
  window.toggleDashTasks = () => {
    const panel = document.getElementById(listId);
    if (!panel) return;
    panel.classList.toggle("hidden");
    document.getElementById("dash-ring-btn")?.classList.toggle("active");
  };

  // Тогл панели инбокса
  window.toggleInboxPanel = () => {
    document.getElementById("dash-inbox-panel")?.classList.toggle("hidden");
  };
}
