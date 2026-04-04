// =============================================
//  MODULE: ПРОЕКТЫ И КАТЕГОРИИ
// =============================================

import { registerModule } from "../router.js";
import { openModal, closeModal, showToast } from "../modal.js";
import {
  getCategories, addCategory, deleteCategory,
  getProjects,   addProject,  deleteProject,
  getTasks,      addTask,     updateTask,    deleteTask
} from "../db.js";

const container = document.getElementById("module-projects");
let navState = { level: "root", catId: null, catName: "", projId: null, projName: "" };

async function render() {
  if      (navState.level === "root") await renderRoot();
  else if (navState.level === "cat")  await renderCategory();
  else if (navState.level === "proj") await renderProject();
}

async function renderRoot() {
  const [cats, projs] = await Promise.all([getCategories(), getProjects()]);
  setTopbarAction(`<button class="btn btn-primary" id="act-btn">+ Категория</button>`,
    () => showAddCategory());
  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">${cats.length} категор${cats.length===1?"ия":cats.length<5?"ии":"ий"} · ${projs.length} проект${projs.length===1?"":projs.length<5?"а":"ов"}</span>
    </div>
    <div class="project-list" id="list">
      ${!cats.length ? `<div class="empty-state"><div class="empty-state-icon">▤</div><p>Категорий нет.<br/>Нажмите «+ Категория»</p></div>` : ""}
    </div>`;
  const list = document.getElementById("list");
  for (const cat of cats) {
    const cp = projs.filter(p => p.catId === cat.id).length;
    const el = mkItem("▤", cat.name, `${cp} проект${cp===1?"":cp<5?"а":"ов"}`, cat.id);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".task-btn")) return;
      navState = { level:"cat", catId:cat.id, catName:cat.name, projId:null, projName:"" };
      render();
    });
    el.querySelector(".task-btn").addEventListener("click", async () => {
      if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
      await deleteCategory(cat.id); showToast("Категория удалена"); render();
    });
    list.appendChild(el);
  }
}

async function renderCategory() {
  const projs = await getProjects(navState.catId);
  setTopbarAction(`<button class="btn btn-primary" id="act-btn">+ Проект</button>`,
    () => showAddProject(navState.catId));
  container.innerHTML = `
    ${bc([{label:"Проекты",idx:0},{label:navState.catName}])}
    <div class="category-header-bar">
      <span class="category-header-name">▤ ${esc(navState.catName)}</span>
      <span style="font-size:12px;opacity:0.8">${projs.length} проект${projs.length===1?"":projs.length<5?"а":"ов"}</span>
    </div>
    <div class="project-list" id="list">
      ${!projs.length ? `<div class="empty-state"><div class="empty-state-icon">☰</div><p>Проектов нет.<br/>Нажмите «+ Проект»</p></div>` : ""}
    </div>`;
  const list = document.getElementById("list");
  for (const proj of projs) {
    const tasks = await getTasks(proj.id);
    const el = mkItem("☰", proj.name, `${tasks.length} задач`, proj.id);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".task-btn")) return;
      navState.level = "proj"; navState.projId = proj.id; navState.projName = proj.name; render();
    });
    el.querySelector(".task-btn").addEventListener("click", async () => {
      if (!confirm(`Удалить проект «${proj.name}»?`)) return;
      await deleteProject(proj.id); showToast("Проект удалён"); render();
    });
    list.appendChild(el);
  }
}

async function renderProject() {
  const tasks = await getTasks(navState.projId);
  setTopbarAction(`<button class="btn btn-primary" id="act-btn">+ Задача</button>`,
    () => showAddTask(navState.projId, navState.catId));
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t =>  t.done);
  container.innerHTML = `
    ${bc([{label:"Проекты",idx:0},{label:navState.catName,idx:1},{label:navState.projName}])}
    <div class="category-header-bar">
      <span class="category-header-name">☰ ${esc(navState.projName)}</span>
      <span style="font-size:12px;opacity:0.8">${tasks.length} задач</span>
    </div>
    <div class="section-header"><span class="section-title">Активные (${open.length})</span></div>
    <div class="project-list" id="list-open">
      ${!open.length ? `<div class="empty-state" style="padding:16px"><p>Активных задач нет</p></div>` : ""}
    </div>
    ${done.length ? `<div class="section-header" style="margin-top:16px"><span class="section-title">Выполнено (${done.length})</span></div><div class="project-list" id="list-done"></div>` : ""}
    <div style="height:80px"></div>`;
  renderTasks(open, "list-open");
  if (done.length) renderTasks(done, "list-done");
}

function renderTasks(arr, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  arr.forEach(t => {
    const dl = t.deadline?.toDate?.() || (t.deadline ? new Date(t.deadline) : null);
    const overdue = dl && dl < new Date() && !t.done;
    const item = document.createElement("div");
    item.className = `task-item ${t.done ? "done" : ""}`;
    item.innerHTML = `
      <div class="task-check ${t.done ? "done" : ""}" data-id="${t.id}">${t.done ? "✓" : ""}</div>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">
          ${dl ? `<span class="${overdue ? "overdue-text" : ""}">${fmtDt(dl)}</span>` : ""}
          ${t.note ? `<span>· ${esc(t.note).slice(0,40)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn del" data-id="${t.id}">✕</button>
      </div>`;
    item.querySelector(".task-check").onclick = async () => {
      await updateTask(t.id, { done: !t.done }); render();
    };
    item.querySelector(".task-btn.del").onclick = async () => {
      if (!confirm("Удалить задачу?")) return;
      await deleteTask(t.id); showToast("Задача удалена"); render();
    };
    el.appendChild(item);
  });
}

// Helpers
function setTopbarAction(html, callback) {
  const el = document.getElementById("topbar-actions");
  el.innerHTML = html;
  el.querySelector("#act-btn")?.addEventListener("click", callback);
}

function mkItem(icon, name, meta, id) {
  const el = document.createElement("div");
  el.className = "project-item";
  el.innerHTML = `
    <div class="project-item-icon">${icon}</div>
    <div class="project-item-body">
      <div class="project-item-name">${esc(name)}</div>
      <div class="project-item-meta">${meta}</div>
    </div>
    <button class="task-btn del" data-id="${id}">✕</button>
    <div class="project-item-arrow">›</div>`;
  return el;
}

function bc(items) {
  return `<div class="projects-breadcrumb">
    ${items.map((item, i) => {
      const isLast = i === items.length - 1;
      if (isLast) return `<span class="breadcrumb-current">${esc(item.label)}</span>`;
      return `<span class="breadcrumb-item" data-idx="${item.idx}">${esc(item.label)}</span><span class="breadcrumb-sep">›</span>`;
    }).join("")}
  </div>`;
}

// Breadcrumb nav via delegation
container.addEventListener("click", (e) => {
  const item = e.target.closest(".breadcrumb-item");
  if (!item) return;
  const idx = parseInt(item.dataset.idx);
  if (idx === 0) { navState = { level:"root" }; render(); }
  else if (idx === 1) { navState.level = "cat"; navState.projId = null; render(); }
});

function showAddCategory() {
  openModal("Новая категория", `
    <div class="form-group"><label class="form-label">Название</label>
    <input class="input" id="c-name" placeholder="Например: Работа" /></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="c-cancel">Отмена</button>
      <button class="btn btn-primary" id="c-save">Создать</button>
    </div>`);
  document.getElementById("c-cancel").onclick = closeModal;
  document.getElementById("c-save").onclick = async () => {
    const name = document.getElementById("c-name").value.trim();
    if (!name) return;
    await addCategory(name); closeModal(); showToast("Категория создана"); render();
  };
}

function showAddProject(catId) {
  openModal("Новый проект", `
    <div class="form-group"><label class="form-label">Название</label>
    <input class="input" id="p-name" placeholder="Название проекта" /></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="p-cancel">Отмена</button>
      <button class="btn btn-primary" id="p-save">Создать</button>
    </div>`);
  document.getElementById("p-cancel").onclick = closeModal;
  document.getElementById("p-save").onclick = async () => {
    const name = document.getElementById("p-name").value.trim();
    if (!name) return;
    await addProject(name, catId); closeModal(); showToast("Проект создан"); render();
  };
}

function showAddTask(projId, catId) {
  openModal("Новая задача", `
    <div class="form-group"><label class="form-label">Название *</label>
    <input class="input" id="t-title" placeholder="Что нужно сделать?" /></div>
    <div class="form-group"><label class="form-label">Дедлайн</label>
    <input class="input" id="t-deadline" type="datetime-local" /></div>
    <div class="form-group"><label class="form-label">Заметка</label>
    <textarea class="textarea" id="t-note" placeholder="Дополнительно..."></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="t-cancel">Отмена</button>
      <button class="btn btn-primary" id="t-save">Сохранить</button>
    </div>`);
  document.getElementById("t-cancel").onclick = closeModal;
  document.getElementById("t-save").onclick = async () => {
    const title = document.getElementById("t-title").value.trim();
    if (!title) { alert("Введите название"); return; }
    await addTask({ title, projId, catId, deadline: document.getElementById("t-deadline").value || null, note: document.getElementById("t-note").value.trim() });
    closeModal(); showToast("Задача добавлена"); render();
  };
}

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmtDt(d) { const p=n=>String(n).padStart(2,"0"); return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }

export function initProjects() {
  registerModule("projects", () => {
    navState = { level:"root", catId:null, catName:"", projId:null, projName:"" };
    render();
  });
}
