// ════════════════════════════════════════
//  FORMS — полный файл
//  js/forms.js
// ════════════════════════════════════════

import { openModal, closeModal, toast, getSubtasks, getActivePriority, setPriority, addSubRow } from "./modal.js";
import {
  addTask, updateTask, deleteTask,
  addGoal, updateGoal, deleteGoal,
  addProject,
  addIdea, updateIdea, getIdeas,
  addDiaryEntry, updateDiaryEntry, getDiary,
  addTemplate, getTemplates,
  getGoals, getProjects,
  getTasks,
  esc, toTS, today, dstr
} from "./db.js";
import { uploadAttachment } from "./storage.js";

const $ = id => document.getElementById(id);

// ════════════════════════════════════════
//  ПРОСМОТРЩИК ФАЙЛОВ
// ════════════════════════════════════════
function showFileViewer(url, type, name) {
  const modal = document.createElement("div");
  modal.className = "file-viewer-overlay";
  const content = document.createElement("div");
  if (type && type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = url; img.style.maxWidth = "100%"; img.style.maxHeight = "90vh";
    content.appendChild(img);
  } else if (type && type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = url; video.controls = true; video.style.maxWidth = "100%"; video.style.maxHeight = "90vh";
    content.appendChild(video);
  } else if (type && type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = url; audio.controls = true; audio.style.width = "100%";
    content.appendChild(audio);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url; iframe.style.width = "80vw"; iframe.style.height = "80vh"; iframe.style.border = "none";
    content.appendChild(iframe);
  }
  modal.appendChild(content);
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

// ════════════════════════════════════════
//  БЫСТРОЕ ДОБАВЛЕНИЕ ЦЕЛИ / ПРОЕКТА
// ════════════════════════════════════════
async function quickAddGoal(callback) {
  openModal("Новая цель", `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="quick-goal-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="quick-goal-desc" placeholder="Описание..."></textarea></div>`,
    async () => {
      const t = $("quick-goal-title")?.value.trim();
      if (!t) { toast("⚠️ Введите название"); return; }
      const newGoal = await addGoal({ title: t, desc: $("quick-goal-desc")?.value.trim() || "" });
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
      const t = $("quick-proj-title")?.value.trim();
      if (!t) { toast("⚠️ Введите название"); return; }
      const newProj = await addProject({ name: t, goalId: $("quick-proj-goal")?.value.trim() || null });
      toast("Проект создан");
      closeModal();
      callback(newProj.id, t);
    });
}

// ════════════════════════════════════════
//  СОЗДАНИЕ ЗАДАЧИ
// ════════════════════════════════════════
export async function buildTaskModal(title, defGoalId = null, defProjId = null, defaultDate = null) {
  let [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  let selectedGoalId = defGoalId || "";
  let attachments = [];
  const dateValue = dstr(defaultDate ? new Date(defaultDate) : new Date());
  let recurrenceType = "none";
  let recurrenceInterval = 1;
  let recurrenceUntil = "";

  function render() {
    const filtP = selectedGoalId ? projects.filter(p => p.goalId === selectedGoalId) : projects;
    $("m-body").innerHTML = `
      <div class="m-section"><div class="m-section-ttl">Основное</div>
        <div class="fg"><label class="fl">Название задачи *</label>
          <input class="inp" id="t-title" placeholder="Введите название"/></div>
        <div class="fg"><label class="fl">Примечание</label>
          <textarea class="txta" id="t-note" placeholder="Примечание..."></textarea></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Привязка к цели</div>
        <div class="fg"><label class="fl">Цель</label>
          <select class="sel" id="t-goal">
            <option value="">— Без цели —</option>
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
        <div class="fg"><label class="fl">Дата выполнения</label>
          <input class="inp" id="t-date" type="date" value="${dateValue}"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Повторение</div>
        <div class="inp-row">
          <select class="sel" id="t-recurrence-type" style="flex:1">
            <option value="none">Нет</option>
            <option value="daily">Ежедневно</option>
            <option value="weekly">Еженедельно</option>
            <option value="monthly">Ежемесячно</option>
            <option value="yearly">Ежегодно</option>
          </select>
          <input class="inp" id="t-recurrence-interval" type="number" value="1" min="1" style="width:70px" placeholder="Кажд."/>
        </div>
        <div class="fg"><label class="fl">Повторять до</label>
          <input class="inp" id="t-recurrence-until" type="date"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Напоминание</div>
        <div class="fg"><label class="fl">Дата и время</label>
          <input class="inp" id="t-reminder" type="datetime-local"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Приоритет</div>
        <div class="pri-row">
          <button class="pri-btn" data-pri="high" onclick="window._setPri('high')">🔴 Высокий</button>
          <button class="pri-btn on-med" data-pri="med" onclick="window._setPri('med')">🟡 Средний</button>
          <button class="pri-btn" data-pri="low" onclick="window._setPri('low')">🟢 Низкий</button>
        </div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="sub-list" class="sub-list"></div>
        <button class="add-sub" onclick="window._addSub()">+ Добавить подзадачу</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <input type="file" id="t-attach" accept="image/*,video/*,audio/*,application/pdf,text/plain,.doc,.docx"/>
        <div id="attach-list" class="sub-list" style="margin-top:6px"></div>
      </div>`;

    $("quick-add-goal-btn")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const sel = $("t-goal");
        const opt = document.createElement("option");
        opt.value.trim() = newId; opt.textContent = esc(newTitle);
        sel.appendChild(opt); sel.value.trim() = newId;
        selectedGoalId = newId; render();
      });
    });
    $("quick-add-proj-btn")?.addEventListener("click", () => {
      quickAddProject(selectedGoalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: selectedGoalId });
        const sel = $("t-proj");
        const opt = document.createElement("option");
        opt.value.trim() = newId; opt.textContent = esc(newName);
        sel.appendChild(opt); sel.value.trim() = newId;
      });
    });
    $("t-goal")?.addEventListener("change", e => { selectedGoalId = e.target.value.trim(); render(); });
    $("t-attach")?.addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      toast("Загрузка...");
      const attached = await uploadAttachment(file, "temp");
      if (attached) {
        attachments.push(attached);
        const list = $("attach-list");
        const div = document.createElement("div");
        div.className = "sub-row";
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);">📎 ${esc(attached.name)}</span><button class="rm-sub">×</button>`;
        list.appendChild(div);
        div.querySelector("span").onclick = () => showFileViewer(attached.url, attached.type, attached.name);
        div.querySelector(".rm-sub").onclick = () => { attachments = attachments.filter(a => a.url !== attached.url); div.remove(); };
      }
      e.target.value.trim() = "";
    });
  }

  openModal(title || "Новая задача", "", async () => {
    const titleVal = $("t-title")?.value.trim();
    if (!titleVal) { toast("⚠️ Введите название задачи"); return; }
    const recType = $("t-recurrence-type")?.value.trim() || "none";
    await addTask({
      title: titleVal,
      note: $("t-note")?.value.trim() || "",
      goalId: $("t-goal")?.value.trim() || null,
      projId: $("t-proj")?.value.trim() || null,
      deadline: $("t-dl")?.value.trim() || null,
      startDate: $("t-start")?.value.trim() || null,
      priority: getActivePriority(),
      subtasks: getSubtasks(),
      date: $("t-date")?.value.trim() || today(),
      reminder: $("t-reminder")?.value.trim() || null,
      attachments,
      recurrence: recType !== "none" ? {
        type: recType,
        interval: parseInt($("t-recurrence-interval")?.value.trim()) || 1,
        until: $("t-recurrence-until")?.value.trim() || null
      } : null,
    });
    toast("Задача добавлена ✓");
    closeModal();
    window._refreshAll?.();
  });
  render();
}

// ════════════════════════════════════════
//  РЕДАКТИРОВАНИЕ ЗАДАЧИ
// ════════════════════════════════════════
export async function editTaskModal(id) {
  const allT = await getTasks();
  const t = allT.find(x => x.id === id);
  if (!t) return;
  const [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  const dlVal  = t.deadline  ? (t.deadline.toDate  ? t.deadline.toDate()  : new Date(t.deadline)).toISOString().slice(0,10)  : "";
  const stVal  = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)).toISOString().slice(0,10) : "";
  const remVal = t.reminder  ? (t.reminder.toDate  ? t.reminder.toDate()  : new Date(t.reminder)).toISOString().slice(0,16)  : "";
  const recurrence = t.recurrence || { type: "none", interval: 1, until: "" };
  let attachments = t.attachments || [];

  function renderEdit() {
    const filtP = t.goalId ? projects.filter(p => p.goalId === t.goalId) : projects;
    $("m-body").innerHTML = `
      <div class="fg"><label class="fl">Название</label>
        <input class="inp" id="et-ttl" value="${esc(t.title)}"/></div>
      <div class="fg"><label class="fl">Примечание</label>
        <textarea class="txta" id="et-note">${esc(t.note || "")}</textarea></div>
      <div class="fg"><label class="fl">Цель</label>
        <select class="sel" id="et-goal">
          <option value="">— Корневая —</option>
          ${goals.map(g => `<option value="${g.id}" ${g.id === t.goalId ? "selected" : ""}>${esc(g.title)}</option>`).join("")}
        </select>
        <button class="add-sub" style="margin-top:4px" id="et-quick-goal">+ Новая цель</button>
      </div>
      <div class="fg"><label class="fl">Проект</label>
        <select class="sel" id="et-proj">
          <option value="">— Без проекта —</option>
          ${filtP.map(p => `<option value="${p.id}" ${p.id === t.projId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
        <button class="add-sub" style="margin-top:4px" id="et-quick-proj">+ Новый проект</button>
      </div>
      <div class="inp-row">
        <div class="fg" style="flex:1"><label class="fl">Начало</label><input class="inp" type="date" id="et-st" value="${stVal}"/></div>
        <div class="fg" style="flex:1"><label class="fl">Дедлайн</label><input class="inp" type="date" id="et-dl" value="${dlVal}"/></div>
      </div>
      <div class="fg"><label class="fl">Дата выполнения</label>
        <input class="inp" type="date" id="et-date" value="${t.date || today()}"/></div>
      <div class="inp-row">
        <select class="sel" id="et-recurrence-type" style="flex:1">
          <option value="none" ${recurrence.type==="none"?"selected":""}>Нет</option>
          <option value="daily" ${recurrence.type==="daily"?"selected":""}>Ежедневно</option>
          <option value="weekly" ${recurrence.type==="weekly"?"selected":""}>Еженедельно</option>
          <option value="monthly" ${recurrence.type==="monthly"?"selected":""}>Ежемесячно</option>
          <option value="yearly" ${recurrence.type==="yearly"?"selected":""}>Ежегодно</option>
        </select>
        <input class="inp" id="et-recurrence-interval" type="number" value="${recurrence.interval||1}" min="1" style="width:70px"/>
      </div>
      <div class="fg"><label class="fl">Повторять до</label>
        <input class="inp" type="date" id="et-recurrence-until" value="${recurrence.until||""}"/></div>
      <div class="fg"><label class="fl">Напоминание</label>
        <input class="inp" type="datetime-local" id="et-reminder" value="${remVal}"/></div>
      <div class="fg"><label class="fl">Приоритет</label>
        <select class="sel" id="et-pri">
          <option value="high" ${t.priority==="high"?"selected":""}>🔴 Высокий</option>
          <option value="med" ${(!t.priority||t.priority==="med")?"selected":""}>🟡 Средний</option>
          <option value="low" ${t.priority==="low"?"selected":""}>🟢 Низкий</option>
        </select>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="edit-sub-list" class="sub-list">
          ${(t.subtasks||[]).map(s=>`<div class="sub-row"><input class="inp" value="${esc(s)}"/><button class="rm-sub" onclick="this.closest('.sub-row').remove()">×</button></div>`).join("")}
        </div>
        <button class="add-sub" onclick="window._addSub('edit-sub-list')">+ Добавить</button>
      </div>
      <div class="m-section"><div class="m-section-ttl">Вложения</div>
        <div id="edit-attach-list" class="sub-list">
          ${attachments.map(a=>`<div class="sub-row"><span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);" data-url="${a.url}" data-type="${a.type||""}" data-name="${esc(a.name)}">📎 ${esc(a.name)}</span><button class="rm-sub" data-url="${a.url}">×</button></div>`).join("")}
        </div>
        <input type="file" id="et-attach"/>
      </div>
      <div style="margin-top:8px">
        <button class="btn-cl" style="color:var(--red);width:100%" onclick="window._delTask('${id}')">🗑 Удалить задачу</button>
      </div>`;

    $("et-quick-goal")?.addEventListener("click", () => {
      quickAddGoal((newId, newTitle) => {
        goals.push({ id: newId, title: newTitle });
        const sel = $("et-goal");
        const opt = document.createElement("option");
        opt.value.trim() = newId; opt.textContent = esc(newTitle);
        sel.appendChild(opt); sel.value.trim() = newId;
        t.goalId = newId; renderEdit();
      });
    });
    $("et-quick-proj")?.addEventListener("click", () => {
      quickAddProject(t.goalId, (newId, newName) => {
        projects.push({ id: newId, name: newName, goalId: t.goalId });
        const sel = $("et-proj");
        const opt = document.createElement("option");
        opt.value.trim() = newId; opt.textContent = esc(newName);
        sel.appendChild(opt); sel.value.trim() = newId;
      });
    });
    document.querySelectorAll("#edit-attach-list span").forEach(span => {
      span.onclick = e => { e.stopPropagation(); showFileViewer(span.dataset.url, span.dataset.type, span.dataset.name); };
    });
    document.querySelectorAll("#edit-attach-list .rm-sub").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); attachments = attachments.filter(a => a.url !== btn.dataset.url); btn.closest(".sub-row").remove(); };
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
        div.innerHTML = `<span style="flex:1;font-size:11px;cursor:pointer;color:var(--blu);">📎 ${esc(attached.name)}</span><button class="rm-sub">×</button>`;
        list.appendChild(div);
        div.querySelector("span").onclick = () => showFileViewer(attached.url, attached.type, attached.name);
        div.querySelector(".rm-sub").onclick = () => { attachments = attachments.filter(a => a.url !== attached.url); div.remove(); };
      }
      e.target.value.trim() = "";
    };
  }

  openModal("Редактировать задачу", "", async () => {
    const newSubtasks = [...($("edit-sub-list")?.querySelectorAll("input")||[])].map(i=>i.value.trim()).filter(Boolean);
    await updateTask(id, {
      title:     $("et-ttl").value.trim(),
      note:      $("et-note").value.trim(),
      goalId:    $("et-goal").value.trim() || null,
      projId:    $("et-proj").value.trim() || null,
      priority:  $("et-pri").value.trim(),
      deadline:  $("et-dl")?.value.trim() || null,
      startDate: $("et-st")?.value.trim() || null,
      date:      $("et-date")?.value.trim() || today(),
      reminder:  $("et-reminder")?.value.trim() || null,
      subtasks:  newSubtasks,
      attachments,
      recurrence: {
        type:     $("et-recurrence-type").value.trim(),
        interval: parseInt($("et-recurrence-interval").value.trim()) || 1,
        until:    $("et-recurrence-until").value.trim() || null,
      }
    });
    toast("Сохранено ✓");
    closeModal();
    window._refreshAll?.();
  });
  renderEdit();
}

// ════════════════════════════════════════
//  ФОРМА ЦЕЛИ
// ════════════════════════════════════════
export async function buildGoalModal(title) {
  openModal(title || "Новая цель", `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="g-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="g-desc" placeholder="Подробнее..."></textarea></div>
    <div class="fg"><label class="fl">Дедлайн</label>
      <input class="inp" id="g-dl" type="date"/></div>`,
    async () => {
      const t = $("g-title")?.value.trim();
      if (!t) { toast("⚠️ Введите название цели"); return; }
      await addGoal({ title: t, desc: $("g-desc")?.value.trim() || "", deadline: $("g-dl")?.value.trim() || null });
      toast("Цель добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════════════════════════════
//  ФОРМА ПРОЕКТА
// ════════════════════════════════════════
export async function buildProjectModal(title, defGoalId = null) {
  const goals = await getGoals();
  openModal(title || "Новый проект", `
    <div class="fg"><label class="fl">Название проекта *</label>
      <input class="inp" id="p-title" placeholder="Название проекта"/></div>
    <div class="fg"><label class="fl">Цель</label>
      <select class="sel" id="p-goal">
        <option value="">— Без цели —</option>
        ${goals.map(g=>`<option value="${g.id}" ${g.id===defGoalId?"selected":""}>${esc(g.title)}</option>`).join("")}
      </select></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="p-desc" placeholder="Описание..."></textarea></div>`,
    async () => {
      const t = $("p-title")?.value.trim();
      if (!t) { toast("⚠️ Введите название"); return; }
      await addProject({ name: t, goalId: $("p-goal")?.value.trim() || null, desc: $("p-desc")?.value.trim() || "" });
      toast("Проект добавлен ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════════════════════════════
//  ФОРМА ИДЕИ
// ════════════════════════════════════════
export function buildIdeaModal(title, defaultDate = null) {
  const dateVal = dstr(defaultDate ? new Date(defaultDate) : new Date());
  openModal(title || "Новая идея", `
    <div class="fg"><label class="fl">Заголовок *</label>
      <input class="inp" id="i-title" placeholder="Название идеи"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="i-text" placeholder="Опишите идею подробнее..."></textarea></div>
    <div class="fg"><label class="fl">Дата</label>
      <input class="inp" id="i-date" type="date" value="${dateVal}"/></div>
    <div class="fg"><label class="fl">Дедлайн (если нужно реализовать до)</label>
      <input class="inp" id="i-dl" type="date"/></div>`,
    async () => {
      const t = $("i-title")?.value.trim();
      if (!t) { toast("⚠️ Введите заголовок"); return; }
      await addIdea({
        title: t,
        text:  $("i-text")?.value.trim() || "",
        date:  $("i-date")?.value.trim() || today(),
        deadline: $("i-dl")?.value.trim() ? toTS($("i-dl").value.trim()) : null,
      });
      toast("Идея добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════════════════════════════
//  РЕДАКТИРОВАНИЕ ИДЕИ
// ════════════════════════════════════════
export async function editIdeaModal(id) {
  const all = await getIdeas();
  const x = all.find(i => i.id === id);
  if (!x) return;
  const dlVal = x.deadline ? (x.deadline.toDate ? x.deadline.toDate() : new Date(x.deadline)).toISOString().slice(0,10) : "";
  openModal("Редактировать идею", `
    <div class="fg"><label class="fl">Заголовок *</label>
      <input class="inp" id="ei-title" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="ei-text">${esc(x.text||"")}</textarea></div>
    <div class="fg"><label class="fl">Дата</label>
      <input class="inp" id="ei-date" type="date" value="${x.date||today()}"/></div>
    <div class="fg"><label class="fl">Дедлайн</label>
      <input class="inp" id="ei-dl" type="date" value="${dlVal}"/></div>
    <div style="margin-top:8px">
      <button class="btn-cl" style="color:var(--red);width:100%" onclick="window.delItem('ideas','${id}')">🗑 Удалить идею</button>
    </div>`,
    async () => {
      const t = $("ei-title")?.value.trim();
      if (!t) { toast("⚠️ Введите заголовок"); return; }
      await updateIdea(id, {
        title: t,
        text:  $("ei-text")?.value.trim() || "",
        date:  $("ei-date")?.value.trim() || today(),
        deadline: $("ei-dl")?.value.trim() ? toTS($("ei-dl").value.trim()) : null,
      });
      toast("Сохранено ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════════════════════════════
//  ФОРМА ДНЕВНИКА
// ════════════════════════════════════════
export async function buildDiaryModal(title, tmpl = null, defaultDate = null) {
  const dateVal  = defaultDate || dstr(new Date());
  const now      = new Date();
  const timeVal  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const tmplBody = tmpl?.body || "";
  let   tags     = [];   // массив тегов текущей записи

  function renderTagsBlock(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = tags.map((tag, i) => `
      <span class="diary-tag">
        #${esc(tag)}
        <button class="diary-tag-rm" onclick="window._diaryRmTag(${i},'${containerId}')">×</button>
      </span>`).join("") +
      `<input class="diary-tag-inp" id="${containerId}-inp"
        placeholder="+ тег (Enter)"
        onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();window._diaryAddTag(this.value.trim(),'${containerId}');this.value.trim()='';}"/>`;
  }

  window._diaryAddTag = (val, cid) => {
    const t = val.trim().replace(/^#/, "").replace(/\s+/g,"_");
    if (t && !tags.includes(t)) { tags.push(t); renderTagsBlock(cid); }
    const inp = document.getElementById(cid + "-inp");
    if (inp) { inp.value.trim() = ""; inp.focus(); }
  };
  window._diaryRmTag = (i, cid) => { tags.splice(i, 1); renderTagsBlock(cid); };

  openModal(title || "Новая запись в дневник", `
    <div class="fg"><label class="fl">Заголовок *</label>
      <input class="inp" id="d-title" placeholder="Заголовок записи" value="${tmpl ? esc(tmpl.title||"") : ""}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="d-text" style="min-height:140px" placeholder="Запиши свои мысли...">${esc(tmplBody)}</textarea></div>
    <div class="inp-row">
      <div class="fg" style="flex:1"><label class="fl">Дата</label>
        <input class="inp" id="d-date" type="date" value="${dateVal}"/></div>
      <div class="fg" style="flex:1"><label class="fl">Время</label>
        <input class="inp" id="d-time" type="time" value="${timeVal}"/></div>
    </div>
    <div class="fg"><label class="fl">Настроение</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px" id="d-mood-row">
        ${["😊 Отлично","🙂 Хорошо","😐 Нейтрально","😔 Плохо","😢 Тяжело"].map(m=>`
          <button class="pri-btn" data-mood="${m}"
            onclick="document.querySelectorAll('[data-mood]').forEach(b=>b.classList.remove('on-med'));this.classList.add('on-med');document.getElementById('d-mood-val').value.trim()='${m}'">${m}</button>`
        ).join("")}
      </div>
      <input type="hidden" id="d-mood-val" value=""/>
    </div>
    <div class="fg"><label class="fl">Теги</label>
      <div class="diary-tags-wrap" id="d-tags-wrap"></div>
      <div style="font-size:10px;color:var(--tx-l);margin-top:4px">Введите тег и нажмите Enter или запятую</div>
    </div>`,
    async () => {
      const t = $("d-title")?.value.trim();
      if (!t) { toast("⚠️ Введите заголовок"); return; }
      // Добавляем незафиксированный тег из поля если есть
      const inp = $("d-tags-wrap-inp");
      if (inp?.value.trim()) window._diaryAddTag(inp.value.trim(), "d-tags-wrap");
      await addDiaryEntry({
        title: t,
        text:  $("d-text")?.value.trim() || "",
        date:  $("d-date")?.value.trim() || today(),
        time:  $("d-time")?.value.trim() || "",
        mood:  $("d-mood-val")?.value.trim() || "",
        tags,
      });
      toast("Запись добавлена ✓");
      closeModal();
      window._refreshAll?.();
    });

  // Рендерим блок тегов после открытия модала
  setTimeout(() => renderTagsBlock("d-tags-wrap"), 0);
}

// ════════════════════════════════════════
//  РЕДАКТИРОВАНИЕ ДНЕВНИКА
// ════════════════════════════════════════
export async function editDiaryModal(id) {
  const all = await getDiary();
  const x = all.find(e => e.id === id);
  if (!x) return;
  let tags = Array.isArray(x.tags) ? [...x.tags] : [];

  function renderTagsBlock(cid) {
    const container = document.getElementById(cid);
    if (!container) return;
    container.innerHTML = tags.map((tag, i) => `
      <span class="diary-tag">
        #${esc(tag)}
        <button class="diary-tag-rm" onclick="window._diaryRmTag(${i},'${cid}')">×</button>
      </span>`).join("") +
      `<input class="diary-tag-inp" id="${cid}-inp"
        placeholder="+ тег (Enter)"
        onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();window._diaryAddTag(this.value.trim(),'${cid}');this.value.trim()='';}"/>`;
  }

  window._diaryAddTag = (val, cid) => {
    const t = val.trim().replace(/^#/, "").replace(/\s+/g,"_");
    if (t && !tags.includes(t)) { tags.push(t); renderTagsBlock(cid); }
    const inp = document.getElementById(cid + "-inp");
    if (inp) { inp.value.trim() = ""; inp.focus(); }
  };
  window._diaryRmTag = (i, cid) => { tags.splice(i, 1); renderTagsBlock(cid); };

  openModal("Редактировать запись", `
    <div class="fg"><label class="fl">Заголовок *</label>
      <input class="inp" id="ed-title" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="ed-text" style="min-height:140px">${esc(x.text||"")}</textarea></div>
    <div class="inp-row">
      <div class="fg" style="flex:1"><label class="fl">Дата</label>
        <input class="inp" id="ed-date" type="date" value="${x.date||today()}"/></div>
      <div class="fg" style="flex:1"><label class="fl">Время</label>
        <input class="inp" id="ed-time" type="time" value="${x.time||""}"/></div>
    </div>
    <div class="fg"><label class="fl">Настроение</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
        ${["😊 Отлично","🙂 Хорошо","😐 Нейтрально","😔 Плохо","😢 Тяжело"].map(m=>`
          <button class="pri-btn ${x.mood===m?"on-med":""}" data-mood="${m}"
            onclick="document.querySelectorAll('[data-mood]').forEach(b=>b.classList.remove('on-med'));this.classList.add('on-med');document.getElementById('ed-mood-val').value.trim()='${m}'">${m}</button>`
        ).join("")}
      </div>
      <input type="hidden" id="ed-mood-val" value="${esc(x.mood||"")}"/>
    </div>
    <div class="fg"><label class="fl">Теги</label>
      <div class="diary-tags-wrap" id="ed-tags-wrap"></div>
      <div style="font-size:10px;color:var(--tx-l);margin-top:4px">Введите тег и нажмите Enter или запятую</div>
    </div>
    <div style="margin-top:8px">
      <button class="btn-cl" style="color:var(--red);width:100%" onclick="window.delItem('diary','${id}')">🗑 Удалить запись</button>
    </div>`,
    async () => {
      const t = $("ed-title")?.value.trim();
      if (!t) { toast("⚠️ Введите заголовок"); return; }
      const inp = $("ed-tags-wrap-inp");
      if (inp?.value.trim()) window._diaryAddTag(inp.value.trim(), "ed-tags-wrap");
      await updateDiaryEntry(id, {
        title: t,
        text:  $("ed-text")?.value.trim() || "",
        date:  $("ed-date")?.value.trim() || today(),
        time:  $("ed-time")?.value.trim() || "",
        mood:  $("ed-mood-val")?.value.trim() || "",
        tags,
      });
      toast("Сохранено ✓");
      closeModal();
      window._refreshAll?.();
    });

  setTimeout(() => renderTagsBlock("ed-tags-wrap"), 0);
}

// ════════════════════════════════════════
//  ФОРМА ШАБЛОНА ДНЕВНИКА
// ════════════════════════════════════════
export function buildTemplateModal(title) {
  openModal(title || "Новый шаблон", `
    <div class="fg"><label class="fl">Название шаблона *</label>
      <input class="inp" id="tmpl-title" placeholder="Например: Утренние страницы"/></div>
    <div class="fg"><label class="fl">Текст шаблона</label>
      <textarea class="txta" id="tmpl-body" style="min-height:120px" placeholder="Шаблонный текст, вопросы для записи..."></textarea></div>`,
    async () => {
      const t = $("tmpl-title")?.value.trim();
      if (!t) { toast("⚠️ Введите название шаблона"); return; }
      await addTemplate({ title: t, body: $("tmpl-body")?.value.trim() || "" });
      toast("Шаблон создан ✓");
      closeModal();
      window._refreshAll?.();
    });
}

// ════════════════════════════════════════
//  ДИСПЕТЧЕР — openNewModal
//  вызывается из app.js через window.openNewModal
// ════════════════════════════════════════
export async function openNewModal(type, goalId = null, projId = null, tab = null, defaultDate = null) {
  switch (type) {
    case "task":     return buildTaskModal("Новая задача", goalId, projId, defaultDate);
    case "goal":     return buildGoalModal("Новая цель");
    case "project":  return buildProjectModal("Новый проект", goalId);
    case "idea":     return buildIdeaModal("Новая идея", defaultDate);
    case "diary":    return buildDiaryModal("Новая запись", null, defaultDate);
    case "template": return buildTemplateModal("Новый шаблон");
    default:         return buildTaskModal("Новая запись", goalId, projId, defaultDate);
  }
}
