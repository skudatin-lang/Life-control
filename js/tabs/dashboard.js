// ════════════════════════════════════════
//  TAB: DASHBOARD
//  js/tabs/dashboard.js
// ════════════════════════════════════════

import { registerTab, taskCard } from "../router.js";
import { getStats, esc, getTasks, dstr, getInbox } from "../db.js";

const MGEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WD   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function initDashboard() { registerTab("dashboard", renderDashboard); }

// ── Напоминания (задачи с reminder в ближайшие 24ч) ──
async function getReminders() {
  const tasks = await getTasks();
  const now = new Date();
  return tasks.filter(t => {
    if (!t.reminder || t.done) return false;
    const remDate = t.reminder.toDate ? t.reminder.toDate() : new Date(t.reminder);
    const diff = (remDate - now) / (1000 * 3600);
    return diff <= 24 && diff >= -1;
  }).slice(0, 5);
}

// ── Streak: серии выполнения для повторяющихся задач ──
async function getStreaks() {
  const tasks = await getTasks();
  const parents = tasks.filter(t => !t.parentId && t.recurrence && t.recurrence.type !== "none");
  const result  = [];
  for (const p of parents) {
    const doneDates = tasks
      .filter(c => c.parentId === p.id && c.done)
      .map(c => c.date)
      .filter(Boolean)
      .sort()
      .reverse();
    if (!doneDates.length) continue;
    let streak = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (const date of doneDates) {
      if (dstr(d) === date) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    if (streak >= 2) result.push({ title: p.title, streak });
  }
  return result.sort((a, b) => b.streak - a.streak).slice(0, 3);
}

// ── Статистика за неделю ──
async function getWeekStats() {
  const tasks = await getTasks();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekDone = tasks.filter(t => {
    if (!t.done || !t.createdAt) return false;
    const d = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return d >= weekAgo;
  }).length;
  return { weekDone, totalOpen: tasks.filter(t => !t.done).length };
}

export async function renderDashboard() {
  const el = document.getElementById("dash-body");
  if (!el) return;

  const [s, reminders, streaks, inbox, ws] = await Promise.all([
    getStats(),
    getReminders(),
    getStreaks(),
    getInbox().catch(() => []),
    getWeekStats(),
  ]);

  const d  = new Date(), h = d.getHours();
  const gr = h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 17 ? "Добрый день" : "Добрый вечер";
  const fname = (document.getElementById("sb-un")?.textContent || "").split(" ")[0] || "друг";

  // ── Блок 1: Daily Focus — isPinned задачи ──
  const pinned = s.tasks.filter(t => t.isPinned && !t.done).slice(0, 3);
  const focusHtml = pinned.length ? `
    <div class="sec-lbl">⭐ Фокус на сегодня</div>
    ${pinned.map((t, i) => `
      <div class="focus-item">
        <span class="focus-num">${i + 1}</span>
        <div style="flex:1;min-width:0">${taskCard(t, s.goals, [])}</div>
      </div>`).join("")}
    <div class="sec-div"></div>` : "";

  // ── Блок 2: Inbox (Место Хаоса) ──
  const inboxHtml = inbox.length ? `
    <div class="inbox-block">
      <div class="inbox-hd">
        <span class="sec-lbl" style="margin:0">⚡ Место Хаоса <span class="inbox-cnt">${inbox.length}</span></span>
        <span class="inbox-hint">разберите входящее</span>
      </div>
      ${inbox.slice(0, 4).map(item => `
        <div class="inbox-item">
          <span class="inbox-txt">${esc(item.text || "—")}</span>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="ib" title="Создать задачу"
              onclick="window._processInbox('${item.id}',${JSON.stringify(item.text || "")})">→</button>
            <button class="ib del" title="Удалить"
              onclick="window._dismissInbox('${item.id}')">✕</button>
          </div>
        </div>`).join("")}
      ${inbox.length > 4 ? `<div style="font-size:10px;color:var(--tx-l);text-align:center;padding:4px 0">ещё ${inbox.length - 4}...</div>` : ""}
    </div>` : "";

  // ── Блок 3: Streaks ──
  const streakHtml = streaks.length ? `
    <div class="sec-lbl">🔥 Серии</div>
    <div class="streak-list">
      ${streaks.map(s => `
        <div class="streak-item">
          <span class="streak-num">${s.streak}</span>
          <span class="streak-title">${esc(s.title)}</span>
        </div>`).join("")}
    </div>
    <div class="sec-div"></div>` : "";

  // ── Блок 4: Статистика недели ──
  const weekHtml = ws.weekDone > 0 ? `
    <div class="week-stats">
      <div class="week-stat"><span class="week-num">${ws.weekDone}</span><span class="week-lbl">за неделю</span></div>
      <div class="week-stat"><span class="week-num">${ws.totalOpen}</span><span class="week-lbl">открытых</span></div>
      <div class="week-stat"><span class="week-num" style="${s.overdue ? "color:var(--red)" : ""}">${s.overdue}</span><span class="week-lbl">просрочено</span></div>
    </div>
    <div class="sec-div"></div>` : "";

  el.innerHTML = `
    <div class="dash-greet">
      <div class="dg-date">${WD[d.getDay()]}, ${d.getDate()} ${MGEN[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="dg-hello">${gr},<br/><span>${esc(fname)}</span> 👋</div>
    </div>

    ${s.overdue ? `<div class="overdue-banner">⚠️ Просрочено задач: ${s.overdue}</div>` : ""}
    ${reminders.length ? `<div class="sec-lbl">🔔 Напоминания</div>${reminders.map(t => taskCard(t, s.goals, [], { clickable: true })).join("")}<div class="sec-div"></div>` : ""}

    ${weekHtml}
    ${focusHtml}
    ${inboxHtml}
    ${streakHtml}

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

    <div class="sec-lbl">Задачи на сегодня</div>
    ${s.todayTasks.length
      ? s.todayTasks.map(t => taskCard(t, s.goals, [])).join("")
      : '<div class="empty"><div class="ei">📋</div><p>На сегодня задач нет</p></div>'}

    <button class="fab" onclick="window.openNewModal('task',null,null,'dashboard')">+</button>`;
}
