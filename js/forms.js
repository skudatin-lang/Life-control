// ════════════════════════════════════════
//  FORMS (исправлен)
//  js/forms.js
// ════════════════════════════════════════

import { openModal, closeModal, toast, getSubtasks, getActivePriority, setPriority, addSubRow } from "./modal.js";
import {
  addTask, updateTask, deleteTask, addGoal, addProject,
  getGoals, getProjects, esc, toTS, today, dstr
} from "./db.js";
import { uploadAttachment } from "./storage.js";
import { curTab } from "./router.js";

const $ = id => document.getElementById(id);

// ── Всплывающий просмотрщик файлов ──
function showFileViewer(url, type, name) {
  const modal = document.createElement("div");
  modal.className = "file-viewer-overlay";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;";
  const content = document.createElement("div");
  content.style.cssText = "max-width:90vw;max-height:90vh;background:#fff;border-radius:12px;overflow:auto;";
  if (type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = url;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "90vh";
    content.appendChild(img);
  } else if (type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.style.maxWidth = "100%";
    video.style.maxHeight = "90vh";
    content.appendChild(video);
  } else if (type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = url;
    audio.controls = true;
    audio.style.width = "100%";
    content.appendChild(audio);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.width = "80vw";
    iframe.style.height = "80vh";
    iframe.style.border = "none";
    content.appendChild(iframe);
  }
  modal.appendChild(content);
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

// ── Вспомогательные функции для inline-добавления цели/проекта ──
async function quickAddGoal(callback) {
  openModal("Новая цель", `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="quick-goal-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="quick-goal-desc" placeholder="Описание..."></textarea></div>`,
    async () => {
      const t = $("#quick-goal-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      const newGoal = await addGoal({ title: t, desc: $("#quick-goal-desc")?.value.trim() || "" });
      toast("Цель создана");
      closeModal();
      callback(newGoal.id, t);
    });
}

async function quickAddProject(goalId, callback) {
  const goals = await getGoals();
  openModal("Новый проект", `
    <div class="fg"><label class="fl">Название проекта *</label>
      <input class="inp" id="quick-proj-title" placeholder="Название"/></div>
    <div class="fg"><label class="fl">Цель</label>
      <select class="sel" id="quick-proj-goal">
        <option value="">— Без цели —</option>
        ${goals.map(g => `<option value="${g.id}" ${g.id === goalId ? "selected" : ""}>${esc(g.title)}</option>`).join("")}
      </select></div>`,
    async () => {
      const t = $("#quick-proj-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      const newProj = await addProject({ name: t, goalId: $("#quick-proj-goal")?.value || null });
      toast("Проект создан");
      closeModal();
      callback(newProj.id, t);
    });
}

// ════════════════ ФОРМА СОЗДАНИЯ ЗАДАЧИ ════════════════
export async function buildTaskModal(title, defGoalId = null, defProjId = null, defaultDate = null) {
  let [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  let selectedGoalId = defGoalId || "";
  let priority = "med";
  let attachments = [];
  const taskDate = defaultDate ? new Date(defaultDate) : new Date();
  const dateValue = dstr(taskDate);
  let recurrenceType = "none";
  let recurrenceInterval = 1;
  let recurrenceUntil = "";

  function render() {
    const filtP = selectedGoalId ? projects.filter(p => p.goalId === selectedGoalId) : projects;
    $("m-body").innerHTML = `
      <div class="m-section"><div class="m-section-ttl">Основное</div>
        <div class="fg"><label class="fl">Название задачи *</label>
          <input class="inp" id="t-title" placeholder="Введите название задачи"/></div>
        <div class="fg"><label class="fl">Примечание</label>
          <textarea class="txta" id="t-note" placeholder="Примечание..."></textarea></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Привязка к цели</div>
        <div class="fg"><label class="fl">Цель</label>
          <select class="sel" id="t-goal">
            <option value="">— Мои цели (корневая) —</option>
            ${goals.map(g => `<option value="${g.id}" ${g.id === selectedGoalId ? "selected" : ""}>${esc(g.title)}</option>`).join("")}
          </select>
          <button class="add-sub" style="margin-top:4px" id="quick-add-goal-btn">+ Новая цель</button>
        </div>
        <div class="fg"><label class="fl">Проект</label>
          <select class="sel" id="t-proj">
            <option value="">— Без проекта —</option>
            ${filtP.map(p => `<option value="${p.id}" ${p.id === defProjId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select>
          <button class="add-sub" style="margin-top:4px" id="quick-add-proj-btn">+ Новый проект</button>
        </div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Сроки</div>
        <div class="inp-row">
          <div class="fg" style="flex:1"><label class="fl">Начать</label>
            <input class="inp" id="t-start" type="date"/></div>
          <div class="fg" style="flex:1"><label class="fl">Закончить до</label>
            <input class="inp" id="t-dl" type="date"/></div>
        </div>
        <div class="fg"><label class="fl">Дата выполнения (для однодневных)</label>
          <input class="inp" id="t-date" type="date" value="${dateValue}"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Повторение</div>
        <div class="inp-row">
          <select class="sel" id="t-recurrence-type" style="flex:1">
            <option value="none" ${recurrenceType === "none" ? "selected" : ""}>Нет</option>
            <option value="daily" ${recurrenceType === "daily" ? "selected" : ""}>Ежедневно</option>
            <option value="weekly" ${recurrenceType === "weekly" ? "selected" : ""}>Еженедельно</option>
            <option value="monthly" ${recurrenceType === "monthly" ? "selected" : ""}>Ежемесячно</option>
            <option value="yearly" ${recurrenceType === "yearly" ? "selected" : ""}>Ежегодно</option>
          </select>
          <input class="inp" id="t-recurrence-interval" type="number" value="${recurrenceInterval}" min="1" style="width:70px" placeholder="Интервал"/>
        </div>
        <div class="fg"><label class="fl">Повторять до</label>
          <input class="inp" id="t-recurrence-until" type="date" value="${recurrenceUntil}"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Напоминание</div>
        <div class="fg"><label class="fl">Дата и время напоминания</label>
          <input class="inp" id="t-reminder" type="datetime-local"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Приоритет</div>
        <div class="pri-row">
          <button class="pri-btn ${priority === "high" ? "on-high" : ""}" data-pri="high" onclick="window._setPri('high')">🔴 Высокий</button>
          <button class="pri-btn ${priority === "med" ? "on-med" : ""}" data-pri="med" onclick="window._setPri('med')">🟡 Средний</button>
          <button class="pri-btn ${priority === "low" ? "on-low" : ""}" data-pri="low" onclick="window._setPri('low')">🟢 Низкий</button>
        </div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="sub-list" class="sub-list"></div>
        <button class="add-sub" onclick="window._addSub()">+ Добавить подзадачу</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <input type="file" id="t-attach" accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx"/>
        <div id="attach-list" class="sub-list" style="margin-top:6px"></div>
      </div>
    `;

    // Обработчики inline-добавления
    $("#quick-add-goal-btn")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const select = $("#t-goal");
        const opt = document.createElement("option");
        opt.value = newId;
        opt.textContent = esc(newTitle);
        select.appendChild(opt);
        select.value = newId;
        selectedGoalId = newId;
        render(); // перерендер для обновления проектов
      });
    });
    $("#quick-add-proj-btn")?.addEventListener("click", () => {
      quickAddProject(selectedGoalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: selectedGoalId });
        const select = $("#t-proj");
        const opt = document.createElement("option");
        opt.value = newId;
        opt.textContent = esc(newName);
        select.appendChild(opt);
        select.value = newId;
      });
    });

    $("#t-attach")?.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      toast("Загрузка...");
      const attached = await uploadAttachment(file, "temp");
      if (attached) {
        attachments.push(attached);
        const list = $("#attach-list");
        const div = document.createElement("div");
        div.className = "sub-row";
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);" data-url="${attached.url}" data-type="${attached.type}" data-name="${esc(attached.name)}">📎 ${esc(attached.name)}</span><button class="rm-sub" data-url="${attached.url}">×</button>`;
        list.appendChild(div);
        div.querySelector("span").onclick = (ev) => {
          ev.stopPropagation();
          showFileViewer(attached.url, attached.type, attached.name);
        };
        div.querySelector(".rm-sub").onclick = () => {
          attachments = attachments.filter(a => a.url !== attached.url);
          div.remove();
        };
      }
      e.target.value = "";
    });

    $("#t-goal")?.addEventListener("change", e => {
      selectedGoalId = e.target.value;
      render();
    });
    $("#t-recurrence-type")?.addEventListener("change", e => {
      recurrenceType = e.target.value;
      render();
    });
    $("#t-recurrence-interval")?.addEventListener("input", e => recurrenceInterval = parseInt(e.target.value) || 1);
    $("#t-recurrence-until")?.addEventListener("change", e => recurrenceUntil = e.target.value);
  }

  openModal(title, "", async () => {
    const titleVal = $("#t-title")?.value.trim();
    if (!titleVal) { alert("Введите название задачи"); return; }
    const recurrence = recurrenceType !== "none" ? {
      type: recurrenceType,
      interval: recurrenceInterval,
      until: recurrenceUntil || null
    } : null;
    const reminder = $("#t-reminder")?.value || null;
    const startDate = $("#t-start")?.value || null;
    const deadline = $("#t-dl")?.value || null;
    const taskDateFinal = $("#t-date")?.value || today();
    await addTask({
      title: titleVal,
      note: $("#t-note")?.value.trim() || "",
      goalId: $("#t-goal")?.value || null,
      projId: $("#t-proj")?.value || null,
      deadline: deadline,
      startDate: startDate,
      priority: getActivePriority(),
      subtasks: getSubtasks(),
      date: taskDateFinal,
      reminder: reminder,
      attachments: attachments,
      recurrence: recurrence,
    });
    toast("Задача добавлена ✓");
    closeModal();
    window._refreshAll?.();
  });
  render();
}

// ════════════════ РЕДАКТИРОВАНИЕ ЗАДАЧИ (исправлено) ════════════════
export async function editTaskModal(id) {
  const allT = await getTasks();
  const t = allT.find(x => x.id === id);
  if (!t) return;

  const [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  const dlVal = t.deadline ? (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline)).toISOString().slice(0, 10) : "";
  const stVal = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)).toISOString().slice(0, 10) : "";
  const remVal = t.reminder ? (t.reminder.toDate ? t.reminder.toDate() : new Date(t.reminder)).toISOString().slice(0, 16) : "";
  const taskDate = t.date || today();
  const recurrence = t.recurrence || { type: "none", interval: 1, until: "" };
  let attachments = t.attachments || [];

  function renderEdit() {
    const filtP = t.goalId ? projects.filter(p => p.goalId === t.goalId) : projects;
    document.getElementById("m-body").innerHTML = `
      <div class="fg"><label class="fl">Название</label>
        <input class="inp" id="et-ttl" value="${esc(t.title)}"/></div>
      <div class="fg"><label class="fl">Примечание</label>
        <textarea class="txta" id="et-note">${esc(t.note || "")}</textarea></div>
      <div class="fg"><label class="fl">Цель</label>
        <select class="sel" id="et-goal">
          <option value="">— Корневая —</option>
          ${goals.map(g => `<option value="${g.id}" ${g.id === t.goalId ? "selected" : ""}>${esc(g.title)}</option>`).join("")}
        </select>
        <button class="add-sub" id="et-quick-goal">+ Новая цель</button>
      </div>
      <div class="fg"><label class="fl">Проект</label>
        <select class="sel" id="et-proj">
          <option value="">— Без проекта —</option>
          ${filtP.map(p => `<option value="${p.id}" ${p.id === t.projId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
        <button class="add-sub" id="et-quick-proj">+ Новый проект</button>
      </div>
      <div class="inp-row">
        <div class="fg"><label>Начало</label><input class="inp" type="date" id="et-st" value="${stVal}"/></div>
        <div class="fg"><label>Дедлайн</label><input class="inp" type="date" id="et-dl" value="${dlVal}"/></div>
      </div>
      <div class="fg"><label>Дата выполнения</label><input class="inp" type="date" id="et-date" value="${taskDate}"/></div>
      <div class="inp-row">
        <select class="sel" id="et-recurrence-type" style="flex:1">
          <option value="none" ${recurrence.type === "none" ? "selected" : ""}>Нет</option>
          <option value="daily" ${recurrence.type === "daily" ? "selected" : ""}>Ежедневно</option>
          <option value="weekly" ${recurrence.type === "weekly" ? "selected" : ""}>Еженедельно</option>
          <option value="monthly" ${recurrence.type === "monthly" ? "selected" : ""}>Ежемесячно</option>
          <option value="yearly" ${recurrence.type === "yearly" ? "selected" : ""}>Ежегодно</option>
        </select>
        <input class="inp" id="et-recurrence-interval" type="number" value="${recurrence.interval || 1}" min="1" style="width:70px"/>
      </div>
      <div class="fg"><label>Повторять до</label><input class="inp" type="date" id="et-recurrence-until" value="${recurrence.until || ""}"/></div>
      <div class="fg"><label>Напоминание</label><input class="inp" type="datetime-local" id="et-reminder" value="${remVal}"/></div>
      <div class="fg"><label>Приоритет</label>
        <select class="sel" id="et-pri">
          <option value="high" ${t.priority === "high" ? "selected" : ""}>🔴 Высокий</option>
          <option value="med" ${(!t.priority || t.priority === "med") ? "selected" : ""}>🟡 Средний</option>
          <option value="low" ${t.priority === "low" ? "selected" : ""}>🟢 Низкий</option>
        </select>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="edit-sub-list" class="sub-list">
          ${(t.subtasks || []).map(sub => `<div class="sub-row"><input class="inp" value="${esc(sub)}"/><button class="rm-sub" onclick="this.closest('.sub-row').remove()">×</button></div>`).join("")}
        </div>
        <button class="add-sub" onclick="window._addSub('edit-sub-list')">+ Добавить</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <div id="edit-attach-list" class="sub-list">
          ${attachments.map(a => `<div class="sub-row"><span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);" data-url="${a.url}" data-type="${a.type}" data-name="${esc(a.name)}">📎 ${esc(a.name)}</span><button class="rm-sub" data-url="${a.url}">×</button></div>`).join("")}
        </div>
        <input type="file" id="et-attach"/>
      </div>
      <div class="modal-footer-btns"><button class="btn-cl" style="color:var(--red)" onclick="window._delTask('${id}')">🗑 Удалить задачу</button></div>
    `;

    // Обработчики inline-добавления
    $("#et-quick-goal")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const select = $("#et-goal");
        const opt = document.createElement("option");
        opt.value = newId;
        opt.textContent = esc(newTitle);
        select.appendChild(opt);
        select.value = newId;
        t.goalId = newId;
        renderEdit();
      });
    });
    $("#et-quick-proj")?.addEventListener("click", () => {
      quickAddProject(t.goalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: t.goalId });
        const select = $("#et-proj");
        const opt = document.createElement("option");
        opt.value = newId;
        opt.textContent = esc(newName);
        select.appendChild(opt);
        select.value = newId;
        t.projId = newId;
      });
    });

    // Просмотр вложений
    document.querySelectorAll("#edit-attach-list span").forEach(span => {
      span.onclick = (e) => {
        e.stopPropagation();
        const url = span.dataset.url;
        const type = span.dataset.type;
        const name = span.dataset.name;
        showFileViewer(url, type, name);
      };
    });

    // Удаление вложений
    document.querySelectorAll("#edit-attach-list .rm-sub").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        attachments = attachments.filter(a => a.url !== url);
        btn.closest(".sub-row").remove();
      };
    });

    // Загрузка нового файла
    $("#et-attach").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      toast("Загрузка...");
      const attached = await uploadAttachment(file, id);
      if (attached) {
        attachments.push(attached);
        const list = $("#edit-attach-list");
        const div = document.createElement("div");
        div.className = "sub-row";
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);" data-url="${attached.url}" data-type="${attached.type}" data-name="${esc(attached.name)}">📎 ${esc(attached.name)}</span><button class="rm-sub" data-url="${attached.url}">×</button>`;
        list.appendChild(div);
        div.querySelector("span").onclick = () => showFileViewer(attached.url, attached.type, attached.name);
        div.querySelector(".rm-sub").onclick = () => {
          attachments = attachments.filter(a => a.url !== attached.url);
          div.remove();
        };
      }
      e.target.value = "";
    };
  }

  openModal("Редактировать задачу", "", async () => {
    const newSubtasks = [...(document.getElementById("edit-sub-list")?.querySelectorAll("input") || [])].map(i => i.value.trim()).filter(Boolean);
    await updateTask(id, {
      title: document.getElementById("et-ttl").value.trim(),
      note: document.getElementById("et-note").value.trim(),
      goalId: document.getElementById("et-goal").value || null,
      projId: document.getElementById("et-proj").value || null,
      priority: document.getElementById("et-pri").value,
      deadline: document.getElementById("et-dl")?.value || null,
      startDate: document.getElementById("et-st")?.value || null,
      date: document.getElementById("et-date")?.value || today(),
      reminder: document.getElementById("et-reminder")?.value || null,
      subtasks: newSubtasks,
      attachments: attachments,
      recurrence: {
        type: document.getElementById("et-recurrence-type").value,
        interval: parseInt(document.getElementById("et-recurrence-interval").value) || 1,
        until: document.getElementById("et-recurrence-until").value || null,
      }
    });
    toast("Сохранено");
    closeModal();
    window._refreshAll?.();
  });
  renderEdit();
}

// Остальные формы (цель, проект, идея, дневник, шаблон) остаются без изменений (можно скопировать из предыдущего ответа)
// Для краткости они здесь опущены, но должны быть в файле.
export async function buildGoalModal(title) { /* ... */ }
export async function buildProjectModal(title, goalId) { /* ... */ }
export function buildIdeaModal(title) { /* ... */ }
export async function buildDiaryModal(title, tmpl, defaultDate) { /* ... */ }
function buildTemplateModal(title) { /* ... */ }
export async function editIdeaModal(id) { /* ... */ }
export async function editDiaryModal(id) { /* ... */ }