// =============================================
//  MODULE: ПЛАН ДНЯ
// =============================================

import { registerModule } from "../router.js";
import { openModal, closeModal, showToast } from "../modal.js";
import {
  getTasksForDate, getDatesWithTasks,
  addTask, updateTask, deleteTask,
  getCategories, getProjects
} from "../db.js";

const container = document.getElementById("module-plan");

const DAYS_SHORT  = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const MONTHS_FULL = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_GEN  = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

let selectedDate = new Date();
selectedDate.setHours(0,0,0,0);
let datesWithTasks = new Set();

function dStr(d) { return d.toISOString().slice(0,10); }

async function render() {
  datesWithTasks = await getDatesWithTasks();
  container.innerHTML = buildUI();
  attachEvents();
  await loadTasks();
}

function buildUI() {
  const today = new Date(); today.setHours(0,0,0,0);
  const selLabel = dStr(selectedDate) === dStr(today)
    ? "Сегодня, " + selectedDate.getDate() + " " + MONTHS_GEN[selectedDate.getMonth()]
    : selectedDate.getDate() + " " + MONTHS_GEN[selectedDate.getMonth()] + " " + selectedDate.getFullYear();

  return `
    <div class="plan-date-nav">
      <button class="plan-date-btn" id="plan-prev">‹</button>
      <div class="plan-date-label" id="plan-date-label">${selLabel}</div>
      <button class="plan-date-btn" id="plan-next">›</button>
    </div>
    ${buildWeekStrip()}
    <div class="section-header">
      <span class="section-title" id="plan-count">Задачи</span>
    </div>
    <div id="plan-tasks" class="plan-tasks">
      <div class="empty-state"><div class="empty-state-icon">◫</div><p>Загрузка...</p></div>
    </div>
    <button class="fab" id="plan-add-btn" title="Добавить задачу">+</button>`;
}

function buildWeekStrip() {
  const monday = new Date(selectedDate);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  let html = '<div class="week-strip">';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const today = new Date(); today.setHours(0,0,0,0);
    const isToday    = dStr(d) === dStr(today);
    const isSelected = dStr(d) === dStr(selectedDate);
    const hasTasks   = datesWithTasks.has(dStr(d));
    const cls = ["week-day", isToday ? "today" : "", isSelected && !isToday ? "selected" : ""].join(" ");
    html += `<div class="${cls}" data-date="${dStr(d)}">
      <span class="wd-name">${DAYS_SHORT[d.getDay()]}</span>
      <span class="wd-num">${d.getDate()}</span>
      ${hasTasks ? '<span class="wd-dot"></span>' : '<span style="width:4px;height:4px"></span>'}
    </div>`;
  }
  html += "</div>";
  return html;
}

async function loadTasks() {
  const tasksEl = document.getElementById("plan-tasks");
  const countEl = document.getElementById("plan-count");
  if (!tasksEl) return;
  const tasks = await getTasksForDate(dStr(selectedDate));
  datesWithTasks = await getDatesWithTasks();
  countEl.textContent = tasks.length ? `${tasks.length} ${pl(tasks.length,"задача","задачи","задач")}` : "Задачи";
  if (!tasks.length) {
    tasksEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◫</div><p>На этот день задач нет</p></div>`;
    return;
  }
  tasksEl.innerHTML = tasks.map(t => {
    const dl = t.deadline?.toDate?.() || (t.deadline ? new Date(t.deadline) : null);
    const overdue = dl && dl < new Date() && !t.done;
    return `<div class="plan-task-item ${t.done ? "done-task" : ""}" data-id="${t.id}">
      <div class="task-check ${t.done ? "done" : ""}" data-id="${t.id}">${t.done ? "✓" : ""}</div>
      <div class="plan-task-body">
        <div class="plan-task-title">${esc(t.title)}</div>
        <div class="plan-task-meta">
          ${dl ? `<span class="${overdue ? "overdue-text" : ""}">${fmtDt(dl)}</span>` : ""}
          ${t.note ? `<span>· ${esc(t.note).slice(0,40)}</span>` : ""}
        </div>
      </div>
      <button class="task-btn del" data-id="${t.id}">✕</button>
    </div>`;
  }).join("");
  tasksEl.querySelectorAll(".task-check").forEach(el => {
    el.addEventListener("click", async () => {
      const task = tasks.find(t => t.id === el.dataset.id);
      if (task) { await updateTask(task.id, { done: !task.done }); await loadTasks(); }
    });
  });
  tasksEl.querySelectorAll(".task-btn.del").forEach(el => {
    el.addEventListener("click", async () => {
      if (!confirm("Удалить задачу?")) return;
      await deleteTask(el.dataset.id);
      showToast("Задача удалена");
      await loadTasks();
    });
  });
}

function attachEvents() {
  document.getElementById("plan-prev")?.addEventListener("click", async () => {
    selectedDate.setDate(selectedDate.getDate() - 1); await render();
  });
  document.getElementById("plan-next")?.addEventListener("click", async () => {
    selectedDate.setDate(selectedDate.getDate() + 1); await render();
  });
  document.getElementById("plan-date-label")?.addEventListener("click", showDatePicker);
  document.getElementById("plan-add-btn")?.addEventListener("click", showAddTask);
  container.querySelectorAll(".week-day").forEach(el => {
    el.addEventListener("click", async () => {
      selectedDate = new Date(el.dataset.date); await render();
    });
  });
}

async function showAddTask() {
  const [cats, projs] = await Promise.all([getCategories(), getProjects()]);
  const defDate = dStr(selectedDate) + "T09:00";
  openModal("Новая задача", `
    <div class="form-group">
      <label class="form-label">Название *</label>
      <input class="input" id="t-title" placeholder="Что нужно сделать?" />
    </div>
    <div class="form-group">
      <label class="form-label">Дедлайн</label>
      <input class="input" id="t-deadline" type="datetime-local" value="${defDate}" />
    </div>
    <div class="form-group">
      <label class="form-label">Категория</label>
      <select class="select" id="t-cat">
        <option value="">— Без категории —</option>
        ${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Проект</label>
      <select class="select" id="t-proj">
        <option value="">— Без проекта —</option>
        ${projs.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Заметка</label>
      <textarea class="textarea" id="t-note" placeholder="Дополнительно..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="t-cancel">Отмена</button>
      <button class="btn btn-primary" id="t-save">Сохранить</button>
    </div>`);
  document.getElementById("t-cancel").onclick = closeModal;
  document.getElementById("t-save").onclick = async () => {
    const title = document.getElementById("t-title").value.trim();
    if (!title) { alert("Введите название задачи"); return; }
    await addTask({
      title,
      deadline: document.getElementById("t-deadline").value || null,
      catId:    document.getElementById("t-cat").value || null,
      projId:   document.getElementById("t-proj").value || null,
      note:     document.getElementById("t-note").value.trim(),
    });
    closeModal(); showToast("Задача добавлена"); await loadTasks();
  };
}

function showDatePicker() {
  let viewDate = new Date(selectedDate);
  const popup = document.createElement("div");
  popup.id = "dp-popup";
  popup.className = "datepicker-popup";
  document.body.appendChild(popup);

  function renderPicker() {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    let cells = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => `<div class="dp-cell day-header">${d}</div>`).join("");
    for (let i = 0; i < offset; i++) {
      const pd = new Date(y, m, -offset + i + 1);
      cells += `<div class="dp-cell other-month">${pd.getDate()}</div>`;
    }
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d);
      const isSel = dStr(dt) === dStr(selectedDate);
      const isTod = dStr(dt) === dStr(today);
      cells += `<div class="dp-cell ${isSel ? "selected" : ""} ${isTod && !isSel ? "today" : ""}" data-date="${dStr(dt)}">${d}</div>`;
    }
    popup.innerHTML = `<div class="datepicker-box">
      <div class="dp-header">
        <button class="dp-nav" id="dp-pm">‹</button>
        <span class="dp-month">${MONTHS_FULL[m]} ${y}</span>
        <button class="dp-nav" id="dp-nm">›</button>
      </div>
      <div class="dp-grid">${cells}</div>
      <button class="dp-confirm" id="dp-ok">Готово</button>
    </div>`;
    popup.querySelector("#dp-pm").onclick = () => { viewDate.setMonth(m - 1); renderPicker(); };
    popup.querySelector("#dp-nm").onclick = () => { viewDate.setMonth(m + 1); renderPicker(); };
    popup.querySelector("#dp-ok").onclick  = () => popup.remove();
    popup.querySelectorAll(".dp-cell:not(.day-header):not(.other-month)").forEach(el => {
      el.onclick = async () => { selectedDate = new Date(el.dataset.date); popup.remove(); await render(); };
    });
    popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
  }
  renderPicker();
}

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmtDt(d) { const p = n=>String(n).padStart(2,"0"); return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} до ${p(d.getHours())}:${p(d.getMinutes())}`; }
function pl(n, one, few, many) { const m=n%100,r=n%10; if(m>=11&&m<=14)return`${n} ${many}`; if(r===1)return`${n} ${one}`; if(r>=2&&r<=4)return`${n} ${few}`; return`${n} ${many}`; }

export function initPlan() {
  registerModule("plan", render);
}
