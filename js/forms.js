// ════════════════════════════════════════
//  FORMS
//  js/forms.js
// ════════════════════════════════════════

import { openModal, closeModal, toast, getSubtasks, getActivePriority, setPriority, addSubRow } from "./modal.js";
import {
  addTask, updateTask, deleteTask, addGoal, updateGoal, addProject,
  addIdea, updateIdea, addDiaryEntry, updateDiaryEntry, addTemplate,
  getGoals, getProjects, getTasks, getIdeas, getDiary, esc, toTS, today, dstr
} from "./db.js";
import { uploadAttachment } from "./storage.js";

const $ = id => document.getElementById(id);

// ── Всплывающий просмотрщик файлов ──
function showFileViewer(url, type, name) {
  const modal = document.createElement("div");
  modal.className = "file-viewer-overlay";
  const content = document.createElement("div");
  if (type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = url; img.style.maxWidth = "100%"; img.style.maxHeight = "90vh";
    content.appendChild(img);
  } else if (type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = url; video.controls = true; video.style.maxWidth = "100%";
    content.appendChild(video);
  } else if (type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = url; audio.controls = true; audio.style.width = "100%";
    content.appendChild(audio);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url; iframe.style.width = "80vw"; iframe.style.height = "80vh";
    iframe.style.border = "none";
    content.appendChild(iframe);
  }
  modal.appendChild(content);
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

// ── Inline-добавление цели ──
async function quickAddGoal(callback) {
  openModal("Новая цель", `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="quick-goal-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="quick-goal-desc" placeholder="Описание..."></textarea></div>`,
    async () => {
      const t = $("quick-goal-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      const newGoal = await addGoal({ title: t, desc: $("quick-goal-desc")?.value.trim() || "" });
      toast("Цель создана");
      closeModal();
      callback(newGoal.id, t);
    });
}

// ── Inline-добавление проекта ──
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
      const t = $("quick-proj-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      const newProj = await addProject({ name: t, goalId: $("quick-proj-goal")?.value || null });
      toast("Проект создан");
      closeModal();
      callback(newProj.id, t);
    });
}

// ════════════════════════════════════════
//  ROUTER: openNewModal
//  Главная точка входа — вызывается из
//  всего приложения через window.openNewModal
// ════════════════════════════════════════
export async function openNewModal(type, goalId = null, projId = null, tab = null, date = null) {
  switch (type) {
    case "task":     return buildTaskModal("Новая задача", goalId, projId, date);
    case "goal":     return buildGoalModal("Новая цель");
    case "project":  return buildProjectModal("Новый проект", goalId);
    case "idea":     return buildIdeaModal("Новая идея", date);
    case "diary":    return buildDiaryModal("Новая запись в дневник", null, date);
    case "template": return buildTemplateModal("Новый шаблон");
    default:         return buildTaskModal("Новая задача", goalId, projId, date);
  }
}

// ════════════════ ЗАДАЧА: СОЗДАНИЕ ════════════════
export async function buildTaskModal(title, defGoalId = null, defProjId = null, defaultDate = null) {
  let [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  let selectedGoalId = defGoalId || "";
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
            <option value="none"    ${recurrenceType==="none"    ? "selected":""}>Нет</option>
            <option value="daily"   ${recurrenceType==="daily"   ? "selected":""}>Ежедневно</option>
            <option value="weekly"  ${recurrenceType==="weekly"  ? "selected":""}>Еженедельно</option>
            <option value="monthly" ${recurrenceType==="monthly" ? "selected":""}>Ежемесячно</option>
            <option value="yearly"  ${recurrenceType==="yearly"  ? "selected":""}>Ежегодно</option>
          </select>
          <input class="inp" id="t-recurrence-interval" type="number"
            value="${recurrenceInterval}" min="1" style="width:70px" placeholder="Интервал"/>
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
          <button class="pri-btn on-med" data-pri="high" onclick="window._setPri('high')">🔴 Высокий</button>
          <button class="pri-btn on-med" data-pri="med"  onclick="window._setPri('med')">🟡 Средний</button>
          <button class="pri-btn on-med" data-pri="low"  onclick="window._setPri('low')">🟢 Низкий</button>
        </div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="sub-list" class="sub-list"></div>
        <button class="add-sub" onclick="window._addSub()">+ Добавить подзадачу</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <input type="file" id="t-attach"
          accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx"/>
        <div id="attach-list" class="sub-list" style="margin-top:6px"></div>
      </div>
    `;

    // Приоритет по умолчанию
    window._setPri("med");

    $("quick-add-goal-btn")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const sel = $("t-goal");
        const opt = document.createElement("option");
        opt.value = newId; opt.textContent = esc(newTitle);
        sel.appendChild(opt); sel.value = newId;
        selectedGoalId = newId; render();
      });
    });
    $("quick-add-proj-btn")?.addEventListener("click", () => {
      quickAddProject(selectedGoalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: selectedGoalId });
        const sel = $("t-proj");
        const opt = document.createElement("option");
        opt.value = newId; opt.textContent = esc(newName);
        sel.appendChild(opt); sel.value = newId;
      });
    });

    $("t-attach")?.addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      toast("Загрузка...");
      const attached = await uploadAttachment(file, "temp");
      if (attached) {
        attachments.push(attached);
        const list = $("attach-list");
        const div = document.createElement("div");
        div.className = "sub-row";
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);"
          data-url="${attached.url}" data-type="${attached.type}" data-name="${esc(attached.name)}">
          📎 ${esc(attached.name)}</span>
          <button class="rm-sub" data-url="${attached.url}">×</button>`;
        list.appendChild(div);
        div.querySelector("span").onclick = () => showFileViewer(attached.url, attached.type, attached.name);
        div.querySelector(".rm-sub").onclick = () => {
          attachments = attachments.filter(a => a.url !== attached.url);
          div.remove();
        };
      }
      e.target.value = "";
    });

    $("t-goal")?.addEventListener("change", e => { selectedGoalId = e.target.value; render(); });
    $("t-recurrence-type")?.addEventListener("change", e => { recurrenceType = e.target.value; render(); });
    $("t-recurrence-interval")?.addEventListener("input", e => recurrenceInterval = parseInt(e.target.value) || 1);
    $("t-recurrence-until")?.addEventListener("change", e => recurrenceUntil = e.target.value);
  }

  openModal(title, "", async () => {
    const titleVal = $("t-title")?.value.trim();
    if (!titleVal) { alert("Введите название задачи"); return; }
    const recurrence = recurrenceType !== "none"
      ? { type: recurrenceType, interval: recurrenceInterval, until: recurrenceUntil || null }
      : null;
    await addTask({
      title:      titleVal,
      note:       $("t-note")?.value.trim() || "",
      goalId:     $("t-goal")?.value || null,
      projId:     $("t-proj")?.value || null,
      deadline:   $("t-dl")?.value || null,
      startDate:  $("t-start")?.value || null,
      priority:   getActivePriority(),
      subtasks:   getSubtasks(),
      date:       $("t-date")?.value || today(),
      reminder:   $("t-reminder")?.value || null,
      attachments,
      recurrence,
    });
    toast("Задача добавлена ✓");
    closeModal();
    window._refreshAll?.();
  });
  render();
}

// ════════════════ ЗАДАЧА: РЕДАКТИРОВАНИЕ ════════════════
export async function editTaskModal(id) {
  const allT = await getTasks();
  const t = allT.find(x => x.id === id);
  if (!t) return;

  const [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  const dlVal  = t.deadline  ? (t.deadline.toDate  ? t.deadline.toDate()  : new Date(t.deadline)).toISOString().slice(0,10) : "";
  const stVal  = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)).toISOString().slice(0,10) : "";
  const remVal = t.reminder  ? (t.reminder.toDate  ? t.reminder.toDate()  : new Date(t.reminder)).toISOString().slice(0,16) : "";
  const taskDate   = t.date || today();
  const recurrence = t.recurrence || { type: "none", interval: 1, until: "" };
  let attachments  = t.attachments || [];

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
        <div class="fg" style="flex:1"><label class="fl">Начало</label>
          <input class="inp" type="date" id="et-st" value="${stVal}"/></div>
        <div class="fg" style="flex:1"><label class="fl">Дедлайн</label>
          <input class="inp" type="date" id="et-dl" value="${dlVal}"/></div>
      </div>
      <div class="fg"><label class="fl">Дата выполнения</label>
        <input class="inp" type="date" id="et-date" value="${taskDate}"/></div>
      <div class="inp-row">
        <select class="sel" id="et-recurrence-type" style="flex:1">
          <option value="none"    ${recurrence.type==="none"    ? "selected":""}>Нет</option>
          <option value="daily"   ${recurrence.type==="daily"   ? "selected":""}>Ежедневно</option>
          <option value="weekly"  ${recurrence.type==="weekly"  ? "selected":""}>Еженедельно</option>
          <option value="monthly" ${recurrence.type==="monthly" ? "selected":""}>Ежемесячно</option>
          <option value="yearly"  ${recurrence.type==="yearly"  ? "selected":""}>Ежегодно</option>
        </select>
        <input class="inp" id="et-recurrence-interval" type="number"
          value="${recurrence.interval || 1}" min="1" style="width:70px"/>
      </div>
      <div class="fg"><label class="fl">Повторять до</label>
        <input class="inp" type="date" id="et-recurrence-until" value="${recurrence.until || ""}"/></div>
      <div class="fg"><label class="fl">Напоминание</label>
        <input class="inp" type="datetime-local" id="et-reminder" value="${remVal}"/></div>
      <div class="fg"><label class="fl">Приоритет</label>
        <select class="sel" id="et-pri">
          <option value="high" ${t.priority==="high"                    ? "selected":""}>🔴 Высокий</option>
          <option value="med"  ${(!t.priority||t.priority==="med")      ? "selected":""}>🟡 Средний</option>
          <option value="low"  ${t.priority==="low"                     ? "selected":""}>🟢 Низкий</option>
        </select>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="edit-sub-list" class="sub-list">
          ${(t.subtasks||[]).map(s =>
            `<div class="sub-row"><input class="inp" value="${esc(s)}"/>
             <button class="rm-sub" onclick="this.closest('.sub-row').remove()">×</button></div>`
          ).join("")}
        </div>
        <button class="add-sub" onclick="window._addSub('edit-sub-list')">+ Добавить</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <div id="edit-attach-list" class="sub-list">
          ${attachments.map(a =>
            `<div class="sub-row">
              <span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);"
                data-url="${a.url}" data-type="${a.type}" data-name="${esc(a.name)}">
                📎 ${esc(a.name)}</span>
              <button class="rm-sub" data-url="${a.url}">×</button>
            </div>`
          ).join("")}
        </div>
        <input type="file" id="et-attach"/>
      </div>
      <div style="margin-top:8px;">
        <button class="btn-cl" style="color:var(--red)"
          onclick="window._delTask('${id}')">🗑 Удалить задачу</button>
      </div>
    `;

    $("et-quick-goal")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const sel = $("et-goal");
        const opt = document.createElement("option");
        opt.value = newId; opt.textContent = esc(newTitle);
        sel.appendChild(opt); sel.value = newId;
        t.goalId = newId; renderEdit();
      });
    });
    $("et-quick-proj")?.addEventListener("click", () => {
      quickAddProject(t.goalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: t.goalId });
        const sel = $("et-proj");
        const opt = document.createElement("option");
        opt.value = newId; opt.textContent = esc(newName);
        sel.appendChild(opt); sel.value = newId;
        t.projId = newId;
      });
    });

    document.querySelectorAll("#edit-attach-list span").forEach(span => {
      span.onclick = e => { e.stopPropagation(); showFileViewer(span.dataset.url, span.dataset.type, span.dataset.name); };
    });
    document.querySelectorAll("#edit-attach-list .rm-sub").forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        attachments = attachments.filter(a => a.url !== btn.dataset.url);
        btn.closest(".sub-row").remove();
      };
    });

    $("et-attach").onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      toast("Загрузка...");
      const attached = await uploadAttachment(file, id);
      if (attached) {
        attachments.push(attached);
        const list = $("edit-attach-list");
        const div = document.createElement("div");
        div.className = "sub-row";
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);"
          data-url="${attached.url}" data-type="${attached.type}" data-name="${esc(attached.name)}">
          📎 ${esc(attached.name)}</span>
          <button class="rm-sub" data-url="${attached.url}">×</button>`;
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
    const newSubs = [...(document.getElementById("edit-sub-list")?.querySelectorAll("input")||[])]
      .map(i => i.value.trim()).filter(Boolean);
    await updateTask(id, {
      title:      document.getElementById("et-ttl").value.trim(),
      note:       document.getElementById("et-note").value.trim(),
      goalId:     document.getElementById("et-goal").value || null,
      projId:     document.getElementById("et-proj").value || null,
      priority:   document.getElementById("et-pri").value,
      deadline:   document.getElementById("et-dl")?.value || null,
      startDate:  document.getElementById("et-st")?.value || null,
      date:       document.getElementById("et-date")?.value || today(),
      reminder:   document.getElementById("et-reminder")?.value || null,
      subtasks:   newSubs,
      attachments,
      recurrence: {
        type:     document.getElementById("et-recurrence-type").value,
        interval: parseInt(document.getElementById("et-recurrence-interval").value) || 1,
        until:    document.getElementById("et-recurrence-until").value || null,
      }
    });
    toast("Сохранено");
    closeModal();
    window._refreshAll?.();
  });
  renderEdit();
}

// ════════════════ ЦЕЛЬ ════════════════
export async function buildGoalModal(title) {
  openModal(title, `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="g-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="g-desc" placeholder="Описание цели..."></textarea></div>`,
    async () => {
      const t = $("g-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      await addGoal({ title: t, desc: $("g-desc")?.value.trim() || "" });
      toast("Цель добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ПРОЕКТ ════════════════
export async function buildProjectModal(title, goalId = null) {
  const goals = await getGoals();
  openModal(title, `
    <div class="fg"><label class="fl">Название проекта *</label>
      <input class="inp" id="p-title" placeholder="Название"/></div>
    <div class="fg"><label class="fl">Цель</label>
      <select class="sel" id="p-goal">
        <option value="">— Без цели —</option>
        ${goals.map(g => `<option value="${g.id}" ${g.id === goalId ? "selected" : ""}>${esc(g.title)}</option>`).join("")}
      </select></div>`,
    async () => {
      const t = $("p-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      await addProject({ name: t, goalId: $("p-goal")?.value || null });
      toast("Проект добавлен ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ИДЕЯ: СОЗДАНИЕ ════════════════
export function buildIdeaModal(title, date = null) {
  const d = date || today();
  openModal(title, `
    <div class="fg"><label class="fl">Заголовок *</label>
      <input class="inp" id="i-title" placeholder="Идея..."/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="i-text" placeholder="Подробнее..."></textarea></div>
    <div class="fg"><label class="fl">Дата</label>
      <input class="inp" type="date" id="i-date" value="${d}"/></div>
    <div class="fg"><label class="fl">Дедлайн (необязательно)</label>
      <input class="inp" type="datetime-local" id="i-dl"/></div>`,
    async () => {
      const t = $("i-title")?.value.trim();
      if (!t) { alert("Введите заголовок"); return; }
      await addIdea({
        title:    t,
        text:     $("i-text")?.value.trim() || "",
        date:     $("i-date")?.value || today(),
        deadline: $("i-dl")?.value || null,
      });
      toast("Идея добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ИДЕЯ: РЕДАКТИРОВАНИЕ ════════════════
export async function editIdeaModal(id) {
  const all = await getIdeas();
  const x = all.find(i => i.id === id); if (!x) return;
  const dlVal = x.deadline ? (x.deadline.toDate ? x.deadline.toDate() : new Date(x.deadline)).toISOString().slice(0,16) : "";
  openModal("Редактировать идею", `
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="ei-title" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="ei-text">${esc(x.text||"")}</textarea></div>
    <div class="fg"><label class="fl">Дата</label>
      <input class="inp" type="date" id="ei-date" value="${x.date||""}"/></div>
    <div class="fg"><label class="fl">Дедлайн</label>
      <input class="inp" type="datetime-local" id="ei-dl" value="${dlVal}"/></div>
    <div style="margin-top:8px;">
      <button class="btn-cl" style="color:var(--red)"
        onclick="window.delItem('ideas','${id}')">🗑 Удалить</button>
    </div>`,
    async () => {
      await updateIdea(id, {
        title:    $("ei-title")?.value.trim(),
        text:     $("ei-text")?.value.trim(),
        date:     $("ei-date")?.value || today(),
        deadline: $("ei-dl")?.value || null,
      });
      toast("Сохранено");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ДНЕВНИК: СОЗДАНИЕ / ШАБЛОН ════════════════
export async function buildDiaryModal(title, tmpl = null, defaultDate = null) {
  const d = defaultDate || today();
  const now = new Date();
  const timeVal = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  openModal(title, `
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="d-title" placeholder="Заголовок записи..."
        value="${esc(tmpl?.title||"")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="d-text" style="min-height:140px"
        placeholder="Что произошло сегодня?">${esc(tmpl?.text||"")}</textarea></div>
    <div class="inp-row">
      <div class="fg" style="flex:1"><label class="fl">Дата</label>
        <input class="inp" type="date" id="d-date" value="${d}"/></div>
      <div class="fg" style="flex:1"><label class="fl">Время</label>
        <input class="inp" type="time" id="d-time" value="${timeVal}"/></div>
    </div>`,
    async () => {
      await addDiaryEntry({
        title: $("d-title")?.value.trim() || "",
        text:  $("d-text")?.value.trim()  || "",
        date:  $("d-date")?.value  || today(),
        time:  $("d-time")?.value  || "",
      });
      toast("Запись добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ДНЕВНИК: РЕДАКТИРОВАНИЕ ════════════════
export async function editDiaryModal(id) {
  const all = await getDiary();
  const x = all.find(e => e.id === id); if (!x) return;
  openModal("Редактировать запись", `
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="ed-title" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="ed-text" style="min-height:140px">${esc(x.text||"")}</textarea></div>
    <div class="inp-row">
      <div class="fg" style="flex:1"><label class="fl">Дата</label>
        <input class="inp" type="date" id="ed-date" value="${x.date||""}"/></div>
      <div class="fg" style="flex:1"><label class="fl">Время</label>
        <input class="inp" type="time" id="ed-time" value="${x.time||""}"/></div>
    </div>
    <div style="margin-top:8px;">
      <button class="btn-cl" style="color:var(--red)"
        onclick="window.delItem('diary','${id}')">🗑 Удалить</button>
    </div>`,
    async () => {
      await updateDiaryEntry(id, {
        title: $("ed-title")?.value.trim() || "",
        text:  $("ed-text")?.value.trim()  || "",
        date:  $("ed-date")?.value  || today(),
        time:  $("ed-time")?.value  || "",
      });
      toast("Сохранено");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════ ШАБЛОН ════════════════
function buildTemplateModal(title) {
  openModal(title, `
    <div class="fg"><label class="fl">Название шаблона *</label>
      <input class="inp" id="tm-title" placeholder="Название..."/></div>
    <div class="fg"><label class="fl">Текст шаблона</label>
      <textarea class="txta" id="tm-text" style="min-height:120px"
        placeholder="Текст по умолчанию..."></textarea></div>`,
    async () => {
      const t = $("tm-title")?.value.trim();
      if (!t) { alert("Введите название"); return; }
      await addTemplate({ title: t, text: $("tm-text")?.value.trim() || "" });
      toast("Шаблон сохранён ✓");
      closeModal();
      window._refreshAll?.();
    });
}
