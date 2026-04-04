// ═══════════════════════════════════════════════════
//  MODULE: TODAY  (План дня)
// ═══════════════════════════════════════════════════

import { subscribeToTasks, toggleTask, formatDate, isOverdue } from "../db.js";
import { openTaskModal } from "../app.js";

let selectedDate = todayStr();
let allTasks = [];
let allProjects = [];
let unsubscribe = null;

export function initToday(tasks, projects) {
  allTasks = tasks;
  allProjects = projects;
  renderWeekStrip();
  renderTodayTasks();
}

export function updateTodayData(tasks, projects) {
  allTasks = tasks;
  allProjects = projects;
  renderWeekStrip();
  renderTodayTasks();
}

// ── Week Strip ──
function renderWeekStrip() {
  const strip = document.getElementById("weekStrip");
  if (!strip) return;
  strip.innerHTML = "";

  const todayDate = todayStr();
  const baseDate = new Date(selectedDate + "T00:00:00");
  const dayOfWeek = baseDate.getDay(); // 0=Sun
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((dayOfWeek + 6) % 7));

  const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = dateToStr(d);
    const hasTasks = allTasks.some(t => t.deadline === ds && !t.done);

    const el = document.createElement("div");
    el.className = "week-day" +
      (ds === selectedDate ? " active" : "") +
      (ds === todayDate ? " today" : "");
    el.innerHTML = `
      <div class="week-day-name">${DAYS[i]}</div>
      <div class="week-day-num">${d.getDate()}</div>
      ${hasTasks ? '<div class="week-dot"></div>' : '<div style="height:4px"></div>'}
    `;
    el.addEventListener("click", () => selectDate(ds));
    strip.appendChild(el);
  }

  // Label + full date
  const lbl = document.getElementById("todayLabel");
  const full = document.getElementById("todayFull");
  if (lbl) lbl.textContent = selectedDate === todayStr() ? "Сегодня" : "Выбранный день";
  if (full) full.textContent = formatDate(selectedDate);
}

function selectDate(ds) {
  selectedDate = ds;
  renderWeekStrip();
  renderTodayTasks();
}

// ── Tasks for selected date ──
function renderTodayTasks() {
  const tasks = allTasks.filter(t => t.deadline === selectedDate);
  const list  = document.getElementById("todayList");
  const empty = document.getElementById("todayEmpty");
  const count = document.getElementById("todayCount");

  if (!list) return;

  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);
  const sorted  = [...pending, ...done];

  if (sorted.length === 0) {
    list.innerHTML = "";
    list.style.display = "none";
    if (empty) empty.style.display = "flex";
    if (count) count.textContent = "Нет задач";
  } else {
    list.style.display = "block";
    if (empty) empty.style.display = "none";
    const nd = pending.length, nd2 = done.length;
    if (count) count.textContent =
      `${nd} активн${plural(nd, "ая","ых","ых")} · ${nd2} выполн${plural(nd2,"ена","ены","ено")}`;

    list.innerHTML = sorted.map(t => taskCardHTML(t)).join("");
    list.querySelectorAll(".task-check").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.closest(".task-card").dataset.id;
        const task = allTasks.find(t => t.id === id);
        if (task) await toggleTask(id, task.done);
      });
    });
    list.querySelectorAll(".task-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const task = allTasks.find(t => t.id === id);
        if (task) openTaskModal(task);
      });
    });
  }

  // Update home badge
  updateHomeBadge(pending.filter(t => t.deadline === todayStr()).length);
}

function taskCardHTML(t) {
  const proj = allProjects.find(p => p.id === t.projectId);
  const over = isOverdue(t.deadline) && !t.done;
  return `
    <div class="task-card ${t.done ? "done" : ""} ${over ? "overdue" : ""}" data-id="${t.id}">
      <div class="task-check">${t.done ? "✓" : ""}</div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">
          ${t.deadline ? `<span class="task-deadline ${over ? "overdue" : ""}">${formatDate(t.deadline)}</span>` : ""}
          ${proj ? `<span class="task-project-tag">${esc(proj.name)}</span>` : ""}
          ${t.note ? `<span style="color:var(--text3)">${esc(t.note)}</span>` : ""}
        </div>
      </div>
    </div>`;
}

function updateHomeBadge(count) {
  const badge = document.getElementById("todayBadge");
  const meta  = document.getElementById("todayMeta");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "block" : "none";
  }
  if (meta) meta.textContent = count > 0 ? `${count} активных задач` : "Задач нет";
}

// ── Date nav buttons ──
document.getElementById("prevDay")?.addEventListener("click", () => {
  const d = new Date(selectedDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  selectDate(dateToStr(d));
});
document.getElementById("nextDay")?.addEventListener("click", () => {
  const d = new Date(selectedDate + "T00:00:00");
  d.setDate(d.getDate() + 1);
  selectDate(dateToStr(d));
});
document.getElementById("addTodayBtn")?.addEventListener("click", () => {
  window.dispatchEvent(new CustomEvent("openQuickAdd", { detail: { date: selectedDate } }));
});

// ── Utils ──
function todayStr() {
  return dateToStr(new Date());
}
function dateToStr(d) {
  return d.toISOString().slice(0, 10);
}
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function plural(n, one, two, five) {
  const abs = Math.abs(n) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return five;
  if (mod === 1) return one;
  if (mod >= 2 && mod <= 4) return two;
  return five;
}

export { selectedDate };
