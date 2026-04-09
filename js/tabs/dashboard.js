// ════════════════════════════════════════
//  TAB: DASHBOARD
//  js/tabs/dashboard.js
// ════════════════════════════════════════

import { registerTab, switchTab, taskCard } from "../router.js";
import { getStats, esc, isOv } from "../db.js";

const MGEN = ["января","февраля","марта","апреля","мая","июня",
              "июля","августа","сентября","октября","ноября","декабря"];
const WD   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function initDashboard() {
  registerTab("dashboard", renderDashboard);
}

async function renderDashboard() {
  const el = document.getElementById("dash-body");
  const s  = await getStats();
  const d  = new Date(), h = d.getHours();
  const gr = h<5 ? "Доброй ночи" : h<12 ? "Доброе утро" : h<17 ? "Добрый день" : "Добрый вечер";
  const fname = (document.getElementById("sb-un").textContent || "").split(" ")[0] || "друг";

  el.innerHTML = `
    <div class="dash-greet">
      <div class="dg-date">${WD[d.getDay()]}, ${d.getDate()} ${MGEN[d.getMonth()]} ${d.getFullYear()}</div>
      <div class="dg-hello">${gr},<br/><span>${esc(fname)}</span> 👋</div>
    </div>

    ${s.overdue ? `<div style="background:rgba(192,64,48,.1);border:1px solid rgba(192,64,48,.35);
      border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-size:13px;
      color:var(--red);font-weight:600;">⚠️ Просрочено задач: ${s.overdue}</div>` : ""}

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
