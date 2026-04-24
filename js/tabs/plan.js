// ════════════════════════════════════════
//  TAB: ПЛАН ДНЯ
//  js/tabs/plan.js
// ════════════════════════════════════════

import { registerTab, buildDayNav, taskCard } from "../router.js";
import { getTasks, getGoals, getProjects, getWeekGoals,
         deleteGoal, deleteProject,
         dstr, esc, isOv, fdt } from "../db.js";
import { GCOLS } from "../utils.js";

let planDate = new Date(); planDate.setHours(0,0,0,0);
let showAll  = false;
let planMode = "day"; // day | all | goals | projects

export function initPlan() { registerTab("plan", renderPlan); }

// ════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════
async function renderPlanSidebar(tasks, goals, projects) {
  const td     = dstr(new Date());
  const todayCnt   = tasks.filter(t => t.date === td).length;
  const monthEnd   = new Date(); monthEnd.setMonth(monthEnd.getMonth()+1); monthEnd.setDate(0);
  const monthEndStr = dstr(monthEnd);
  const monthlyCnt = tasks.filter(t => t.date >= td && t.date <= monthEndStr).length;

  document.getElementById("sb-body").innerHTML = `
    <div class="sb-tiles-grid">
      <button class="sb-tile ${planMode==="day"?"on":""}" onclick="window._planMode('day')">
        <div class="sb-tile-ico">📋</div>
        <div class="sb-tile-lbl">Задачи дня</div>
        <div class="sb-tile-cnt">${todayCnt}</div>
      </button>
      <button class="sb-tile ${planMode==="all"?"on":""}" onclick="window._planMode('all')">
        <div class="sb-tile-ico">📅</div>
        <div class="sb-tile-lbl">Мои задачи</div>
        <div class="sb-tile-cnt">${monthlyCnt}</div>
      </button>
      <button class="sb-tile ${planMode==="goals"?"on":""}" onclick="window._planMode('goals')">
        <div class="sb-tile-ico">🎯</div>
        <div class="sb-tile-lbl">Мои цели</div>
        <div class="sb-tile-cnt">${goals.length}</div>
      </button>
      <button class="sb-tile ${planMode==="projects"?"on":""}" onclick="window._planMode('projects')">
        <div class="sb-tile-ico">📁</div>
        <div class="sb-tile-lbl">Проекты</div>
        <div class="sb-tile-cnt">${projects.length}</div>
      </button>
    </div>`;
}

// ════════════════════════════════════════
//  ПРАВАЯ ЧАСТЬ — зависит от режима
// ════════════════════════════════════════
async function renderPlanMain(tasks, goals, projects) {
  const body = document.getElementById("plan-body");
  const td   = dstr(new Date());

  if (planMode === "day") {
    // ── Обычный план дня с dayNav ──
    body.innerHTML = `<div id="plan-dn"></div><div id="plan-open"></div><div id="plan-done-sec"></div>`;
    const datesWT = new Set(tasks.filter(x => x.date).map(x => x.date));
    buildDayNav(planDate, datesWT, showAll, "plan-dn",
      d => { planDate = d; showAll = false; renderPlan(); },
      () => { showAll = !showAll; renderPlan(); }
    );
    const targetStr = dstr(planDate);
    const filtered  = showAll ? tasks : tasks.filter(t => {
      if (t.date === targetStr) return true;
      const start = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)) : null;
      const end   = t.deadline  ? (t.deadline.toDate  ? t.deadline.toDate()  : new Date(t.deadline))  : null;
      if (start && end && !t.date) {
        const target = new Date(targetStr); target.setHours(0,0,0,0);
        return target >= start && target <= end;
      }
      return false;
    });
    const open = filtered.filter(t => !t.done).sort((a,b) => (a.deadline||"") > (b.deadline||"") ? 1 : -1);
    const done = filtered.filter(t =>  t.done);
    document.getElementById("plan-open").innerHTML = open.length
      ? open.map(t => taskCard(t, goals, projects)).join("")
      : '<div class="empty"><div class="ei">📋</div><p>Задач нет — нажмите «+»</p></div>';
    if (done.length)
      document.getElementById("plan-done-sec").innerHTML =
        `<div class="sec-div"></div><div class="sec-lbl">Выполнено (${done.length})</div>
         ${done.map(t => taskCard(t, goals, projects)).join("")}`;
    body.insertAdjacentHTML("beforeend",
      `<button class="fab" onclick="window.openNewModal('task',null,null,'plan','${targetStr}')">+</button>`);

  } else if (planMode === "all") {
    // ── Все задачи до конца месяца ──
    const monthEnd    = new Date(); monthEnd.setMonth(monthEnd.getMonth()+1); monthEnd.setDate(0);
    const monthEndStr = dstr(monthEnd);
    const monthly     = tasks
      .filter(t => t.date >= td && t.date <= monthEndStr)
      .sort((a,b) => (a.date||"") > (b.date||"") ? 1 : -1);
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Задачи до конца месяца (${monthly.length})</div>
      <div id="plan-all-list">
        ${monthly.length
          ? monthly.map(t => taskCard(t, goals, projects)).join("")
          : '<div class="empty"><div class="ei">📅</div><p>Задач нет</p></div>'}
      </div>
      <button class="fab" onclick="window.openNewModal('task',null,null,'plan')">+</button>`;

  } else if (planMode === "goals") {
    // ── Все цели ──
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Мои цели (${goals.length})</div>
      ${goals.length ? goals.map((g, i) => `
        <div class="icard" style="border-left:4px solid ${GCOLS[i%GCOLS.length]}">
          <div class="ic-body">
            <div class="ic-ttl">${esc(g.title)}</div>
            ${g.desc ? `<div style="font-size:12px;color:var(--tx-m);margin-top:3px">${esc(g.desc)}</div>` : ""}
            <div class="ic-meta">
              <span class="ic-tag tag-goal">${tasks.filter(t=>t.goalId===g.id).length} задач</span>
            </div>
          </div>
          <div class="ic-acts">
            <button class="ib del" onclick="event.stopPropagation();window._planDelGoal('${g.id}')">🗑</button>
          </div>
        </div>`).join("")
      : '<div class="empty"><div class="ei">🎯</div><p>Целей нет</p></div>'}
      <button class="fab" onclick="window.openNewModal('goal',null,null,'plan')">+</button>`;

  } else if (planMode === "projects") {
    // ── Все проекты ──
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Мои проекты (${projects.length})</div>
      ${projects.length ? projects.map((p, i) => {
        const goal = goals.find(g => g.id === p.goalId);
        const col  = goal ? GCOLS[goals.indexOf(goal) % GCOLS.length] : "var(--go)";
        return `
          <div class="icard" style="border-left:4px solid ${col}">
            <div class="ic-body">
              <div class="ic-ttl">${esc(p.name)}</div>
              ${p.desc ? `<div style="font-size:12px;color:var(--tx-m);margin-top:3px">${esc(p.desc)}</div>` : ""}
              <div class="ic-meta">
                ${goal ? `<span class="ic-tag tag-goal">↳ ${esc(goal.title)}</span>` : ""}
                <span class="ic-tag tag-proj">${tasks.filter(t=>t.projId===p.id).length} задач</span>
              </div>
            </div>
            <div class="ic-acts">
              <button class="ib del" onclick="event.stopPropagation();window._planDelProj('${p.id}')">🗑</button>
            </div>
          </div>`;
      }).join("")
      : '<div class="empty"><div class="ei">📁</div><p>Проектов нет</p></div>'}
      <button class="fab" onclick="window.openNewModal('project',null,null,'plan')">+</button>`;
  }
}

// ════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════
export async function renderPlan() {
  document.getElementById("tb-ttl").textContent = "План дня";
  const [tasks, goals, projects] = await Promise.all([getTasks(), getGoals(), getProjects()]);
  await renderPlanSidebar(tasks, goals, projects);
  await renderPlanMain(tasks, goals, projects);
}

// ── Глобальные хэндлеры ──
window._planMode = async mode => {
  planMode = mode;
  const [tasks, goals, projects] = await Promise.all([getTasks(), getGoals(), getProjects()]);
  await renderPlanSidebar(tasks, goals, projects);
  await renderPlanMain(tasks, goals, projects);
};

window._planDelGoal = async id => {
  if (!confirm("Удалить цель?")) return;
  const { deleteGoal } = await import("../db.js");
  await deleteGoal(id);
  window._refreshAll?.();
};

window._planDelProj = async id => {
  if (!confirm("Удалить проект?")) return;
  const { deleteProject } = await import("../db.js");
  await deleteProject(id);
  window._refreshAll?.();
};
