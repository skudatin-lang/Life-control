// ════════════════════════════════════════
//  TAB: ПЛАН ДНЯ
//  js/tabs/plan.js
// ════════════════════════════════════════

import { registerTab, buildDayNav, taskCard } from "../router.js";
import { getTasks, getGoals, getProjects, getWeekGoals, dstr, esc } from "../db.js";
import { GCOLS } from "../utils.js";

let planDate = new Date(); planDate.setHours(0,0,0,0);
let showAll = false;

export function initPlan() { registerTab("plan", renderPlan); }

export async function renderPlan() {
  document.getElementById("tb-ttl").textContent = "План дня";
  const [tasks, goals, projects, wgArr] = await Promise.all([getTasks(), getGoals(), getProjects(), getWeekGoals()]);
  const wg = wgArr[0] || { id: null };
  // Sidebar
  const sb = document.getElementById("sb-body");
  sb.innerHTML = `<div class="sb-sec">Мои цели</div>${goals.length ? goals.map((g,i)=>`<div class="goal-pill" style="background:${GCOLS[i%GCOLS.length]}" onclick="window.switchTab('goals')">${esc(g.title)}<span class="gp-cnt">${tasks.filter(t=>t.goalId===g.id).length}</span></div>`).join(""):'<p style="font-size:11px;color:var(--tx-l)">Целей нет</p>'}<div style="margin-top:14px"><div class="sb-sec">Цель недели</div><div class="wg-block"><div class="wg-val" contenteditable id="wg-w" data-ph="Введите цель..." onblur="window._saveWG('week',this.textContent,'${wg.id||""}')">${esc(wg.week||"")}</div></div><div class="sb-sec">Цель на месяц</div><div class="wg-block"><div class="wg-val" contenteditable id="wg-m" data-ph="Введите цель..." onblur="window._saveWG('month',this.textContent,'${wg.id||""}')">${esc(wg.month||"")}</div></div><div class="sb-sec">Цель на год</div><div class="wg-block"><div class="wg-val" contenteditable id="wg-y" data-ph="Введите цель..." onblur="window._saveWG('year',this.textContent,'${wg.id||""}')">${esc(wg.year||"")}</div></div></div>`;

  const body = document.getElementById("plan-body");
  body.innerHTML = `<div id="plan-dn"></div><div id="plan-open"></div><div id="plan-done-sec"></div>`;
  const datesWT = new Set(tasks.filter(x => x.date).map(x => x.date));
  buildDayNav(planDate, datesWT, showAll, "plan-dn",
    d => { planDate = d; showAll = false; renderPlan(); },
    () => { showAll = !showAll; renderPlan(); }
  );

  const targetDateStr = dstr(planDate);
  // Фильтрация: дата точного выполнения ИЛИ диапазон startDate..deadline
  const filtered = showAll ? tasks : tasks.filter(t => {
    if (t.date === targetDateStr) return true;
    const start = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)) : null;
    const end = t.deadline ? (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)) : null;
    if (start && end && !t.date) {
      const target = new Date(targetDateStr);
      target.setHours(0,0,0,0);
      return target >= start && target <= end;
    }
    return false;
  });

  const open = filtered.filter(t => !t.done).sort((a,b)=> (a.deadline||"") > (b.deadline||"") ? 1 : -1);
  const done = filtered.filter(t => t.done);
  document.getElementById("plan-open").innerHTML = open.length ? open.map(t => taskCard(t, goals, projects)).join("") : '<div class="empty"><div class="ei">📋</div><p>Задач нет — нажмите «+»</p></div>';
  if (done.length) document.getElementById("plan-done-sec").innerHTML = `<div class="sec-div"></div><div class="sec-lbl">Выполнено (${done.length})</div>${done.map(t=>taskCard(t,goals,projects)).join("")}`;
  body.insertAdjacentHTML("beforeend", `<button class="fab" onclick="window.openNewModal('task',null,null,'plan','${targetDateStr}')">+</button>`);
}