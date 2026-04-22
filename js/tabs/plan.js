// ════════════════════════════════════════
//  TAB: ПЛАН ДНЯ
//  js/tabs/plan.js
// ════════════════════════════════════════

import { registerTab, buildDayNav, taskCard } from "../router.js";
import { getTasks, getGoals, getProjects, getWeekGoals, updateTask, dstr, esc } from "../db.js";
import { GCOLS } from "../utils.js";

let planDate = new Date(); planDate.setHours(0, 0, 0, 0);
let showAll  = false;

export function initPlan() { registerTab("plan", renderPlan); }

export async function renderPlan() {
  document.getElementById("tb-ttl").textContent = "План дня";

  const [tasks, goals, projects, wgArr] = await Promise.all([
    getTasks(), getGoals(), getProjects(), getWeekGoals()
  ]);
  const wg = wgArr[0] || { id: null };

  // ── Sidebar ──
  const sb = document.getElementById("sb-body");
  sb.innerHTML = `
    <div class="sb-sec">Мои цели</div>
    ${goals.length
      ? goals.map((g, i) => `
          <div class="goal-pill" style="background:${GCOLS[i % GCOLS.length]}"
               onclick="window.switchTab('goals')">
            ${esc(g.title)}
            <span class="gp-cnt">${tasks.filter(t => t.goalId === g.id).length}</span>
          </div>`).join("")
      : '<p>Нет целей</p>'}
    <div style="margin-top:14px">
      <div class="sb-sec">Цель недели</div>
      <div class="wg-block">
        <div class="wg-val" contenteditable id="wg-w"
             onblur="window._saveWG('week',this.textContent,'${wg.id || ""}')">${esc(wg.week || "")}</div>
      </div>
      <div class="sb-sec">Цель на месяц</div>
      <div class="wg-block">
        <div class="wg-val" contenteditable id="wg-m"
             onblur="window._saveWG('month',this.textContent,'${wg.id || ""}')">${esc(wg.month || "")}</div>
      </div>
      <div class="sb-sec">Цель на год</div>
      <div class="wg-block">
        <div class="wg-val" contenteditable id="wg-y"
             onblur="window._saveWG('year',this.textContent,'${wg.id || ""}')">${esc(wg.year || "")}</div>
      </div>
    </div>`;

  // ── Body ──
  const body = document.getElementById("plan-body");
  body.innerHTML = `
    <div id="plan-dn"></div>
    <div id="plan-tag-filters"></div>
    <div id="plan-open"></div>
    <div id="plan-done-sec"></div>`;

  const datesWT = new Set(tasks.filter(x => x.date).map(x => x.date));

  buildDayNav(planDate, datesWT, showAll, "plan-dn",
    d => { planDate = d; showAll = false; renderPlan(); },
    () => { showAll = !showAll; renderPlan(); }
  );

  // ── Drag-and-drop на кнопки дней ──
  document.querySelectorAll("#plan-dn .ds-day").forEach(btn => {
    btn.addEventListener("dragover",  e => { e.preventDefault(); btn.classList.add("drag-over"); });
    btn.addEventListener("dragleave", ()  => btn.classList.remove("drag-over"));
    btn.addEventListener("drop", async e => {
      e.preventDefault();
      btn.classList.remove("drag-over");
      const tid = e.dataTransfer.getData("taskId");
      if (!tid) return;
      await updateTask(tid, { date: btn.dataset.date });
      window._refreshAll?.();
    });
  });

  // ── Теги ──
  const allTags = [...new Set(tasks.flatMap(t => t.tags || []))].filter(Boolean);
  const activeTag = window._activeTag || null;
  if (allTags.length) {
    document.getElementById("plan-tag-filters").innerHTML = `
      <div class="tag-filters">
        ${allTags.map(tag => `
          <button class="tag-filter-btn ${activeTag === tag ? "on" : ""}"
                  onclick="window._setTagFilter('${esc(tag)}')">#${esc(tag)}</button>`
        ).join("")}
      </div>`;
  }

  // ── Фильтрация задач ──
  const targetDateStr = dstr(planDate);
  let filtered = showAll ? tasks : tasks.filter(t => {
    if (t.date === targetDateStr) return true;
    const start = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)) : null;
    const end   = t.deadline  ? (t.deadline.toDate  ? t.deadline.toDate()  : new Date(t.deadline))  : null;
    if (start && end && !t.date) {
      const target = new Date(targetDateStr); target.setHours(0, 0, 0, 0);
      return target >= start && target <= end;
    }
    return false;
  });

  if (activeTag) filtered = filtered.filter(t => (t.tags || []).includes(activeTag));

  // Сортировка: pinned → высокий приоритет → дедлайн
  const priOrder = { high: 0, med: 1, low: 2 };
  const open = filtered.filter(t => !t.done).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const pa = priOrder[a.priority] ?? 1, pb = priOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.deadline || "") > (b.deadline || "") ? 1 : -1;
  });
  const done = filtered.filter(t => t.done);

  // ── Рендер с drag-атрибутами и pin-кнопкой ──
  const renderCard = t => {
    const base  = taskCard(t, goals, projects);
    const pinIc = t.isPinned ? "⭐" : "☆";
    // Добавляем draggable и pin-кнопку
    return base
      .replace(
        'class="icard',
        `class="icard" draggable="true" data-task-id="${t.id}" `
      )
      .replace(
        'class="ic-acts"',
        `class="ic-acts"><button class="ib pin-btn ${t.isPinned ? "pinned" : ""}"
          title="${t.isPinned ? "Убрать из фокуса" : "В фокус дня"}"
          onclick="event.stopPropagation();window._pinTask('${t.id}',${!!t.isPinned})">${pinIc}</button`
      );
  };

  document.getElementById("plan-open").innerHTML = open.length
    ? open.map(renderCard).join("")
    : '<div class="empty"><div class="ei">📋</div><p>Задач нет — нажмите «+»</p></div>';

  if (done.length) {
    document.getElementById("plan-done-sec").innerHTML =
      `<div class="sec-div"></div><div class="sec-lbl">Выполнено (${done.length})</div>`
      + done.map(renderCard).join("");
  }

  body.insertAdjacentHTML("beforeend",
    `<button class="fab" onclick="window.openNewModal('task',null,null,'plan','${targetDateStr}')">+</button>`);
}

// ── Глобальный drag-start (работает для всех карточек в плане) ──
document.addEventListener("dragstart", e => {
  const card = e.target.closest("[data-task-id]");
  if (card) {
    e.dataTransfer.setData("taskId", card.dataset.taskId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { card.style.opacity = "0.45"; }, 0);
  }
});
document.addEventListener("dragend", e => {
  const card = e.target.closest("[data-task-id]");
  if (card) card.style.opacity = "";
});
