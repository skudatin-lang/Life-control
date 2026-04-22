// ════════════════════════════════════════
//  NEW ENTRY FORMS
//  js/forms.js
//  Все модальные формы создания/редактирования
// ════════════════════════════════════════

import { openModal, closeModal, toast, getSubtasks, getActivePriority, setPriority, addSubRow } from "./modal.js";
import {
  addTask, updateTask, deleteTask,
  addGoal, addProject,
  addIdea, updateIdea,
  addDiaryEntry, updateDiaryEntry,
  addTemplate,
  getGoals, getProjects,
  esc, toTS, today, dstr
} from "./db.js";
import { curTab } from "./router.js";

// ── Modal titles by tab and type ──
const TITLES = {
  task:     { plan:"Новая задача",       goals:"Новая задача",    dashboard:"Новая задача",  ideas:"Новая задача",      diary:"Новая задача"      },
  goal:     { goals:"Новая цель",        plan:"Новая цель",       dashboard:"Новая цель",    ideas:"Новая цель",        diary:"Новая цель"         },
  project:  { goals:"Новый проект",      plan:"Новый проект",     dashboard:"Новый проект",  ideas:"Новый проект",      diary:"Новый проект"       },
  idea:     { ideas:"Новая идея",        dashboard:"Новая идея",  plan:"Новая идея",         goals:"Новая идея",        diary:"Новая идея"         },
  diary:    { diary:"Новая запись",      dashboard:"Новая запись",plan:"Новая запись",        goals:"Новая запись",      ideas:"Новая запись"       },
  template: { diary:"Новый шаблон",      dashboard:"Новый шаблон",plan:"Новый шаблон",       goals:"Новый шаблон",      ideas:"Новый шаблон"       },
};

const $ = id => document.getElementById(id);

// ── Open new entry modal (called from anywhere) ──
export async function openNewModal(type = "task", parentGoalId = null, parentProjId = null, fromTab = null, defaultDate = null) {
  const tab   = fromTab || curTab;
  const title = TITLES[type]?.[tab] || ("Новая " + type);
  if      (type === "task")     await buildTaskModal(title, parentGoalId, parentProjId, defaultDate);
  else if (type === "goal")     await buildGoalModal(title);
  else if (type === "project")  await buildProjectModal(title, parentGoalId);
  else if (type === "idea")          buildIdeaModal(title);
  else if (type === "diary")    await buildDiaryModal(title, null, defaultDate);
  else if (type === "template")      buildTemplateModal(title);
}

// ════════════════ TASK FORM ════════════════
async function buildTaskModal(title, defGoalId = null, defProjId = null, defaultDate = null) {
  const [goals, projects] = await Promise.all([getGoals(), getProjects()]);
  let selectedGoalId = defGoalId || "";
  let priority       = "med";
  // дата выполнения по умолчанию: сегодня или переданная
  const taskDate = defaultDate ? new Date(defaultDate) : new Date();
  const dateValue = dstr(taskDate);

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
            ${goals.map(g => `<option value="${g.id}" ${g.id===selectedGoalId?"selected":""}>${esc(g.title)}</option>`).join("")}
          </select></div>
        <div class="fg"><label class="fl">Проект</label>
          <select class="sel" id="t-proj">
            <option value="">— Без проекта —</option>
            ${filtP.map(p => `<option value="${p.id}" ${p.id===defProjId?"selected":""}>${esc(p.name)}</option>`).join("")}
          </select></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Сроки</div>
        <div class="inp-row">
          <div class="fg" style="flex:1"><label class="fl">Начать</label>
            <input class="inp" id="t-start" type="datetime-local"/></div>
          <div class="fg" style="flex:1"><label class="fl">Закончить до</label>
            <input class="inp" id="t-dl" type="datetime-local"/></div>
        </div>
        <div class="fg"><label class="fl">Дата выполнения</label>
          <input class="inp" id="t-date" type="date" value="${dateValue}"/></div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Приоритет</div>
        <div class="pri-row">
          <button class="pri-btn ${priority==="high"?"on-high":""}" data-pri="high"
            onclick="window._setPri('high')">🔴 Высокий</button>
          <button class="pri-btn ${priority==="med"?"on-med":""}" data-pri="med"
            onclick="window._setPri('med')">🟡 Средний</button>
          <button class="pri-btn ${priority==="low"?"on-low":""}" data-pri="low"
            onclick="window._setPri('low')">🟢 Низкий</button>
        </div>
      </div>
      <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
        <div id="sub-list" class="sub-list"></div>
        <button class="add-sub" onclick="window._addSub()">+ Добавить подзадачу</button>
      </div>`;

    $("t-goal")?.addEventListener("change", e => {
      selectedGoalId = e.target.value; render();
    });
  }

  openModal(title, "", async () => {
    const titleVal = ($("t-title")?.value || "").trim();
    if (!titleVal) { alert("Введите название задачи"); return; }
    await addTask({
      title:     titleVal,
      note:      $("t-note")?.value.trim() || "",
      goalId:    $("t-goal")?.value  || null,
      projId:    $("t-proj")?.value  || null,
      deadline:  $("t-dl")?.value    || null,
      startDate: $("t-start")?.value || null,
      priority:  getActivePriority(),
      subtasks:  getSubtasks(),
      date:      $("t-date")?.value  || today()
    });
    toast("Задача добавлена ✓");
    closeModal();
    window._refreshAll?.();
  });
  render();
}

// ════════════════ GOAL FORM ════════════════
async function buildGoalModal(title) {
  openModal(title, `
    <div class="fg"><label class="fl">Название цели *</label>
      <input class="inp" id="g-title" placeholder="Чего хочу достичь?"/></div>
    <div class="fg"><label class="fl">Описание</label>
      <textarea class="txta" id="g-desc" placeholder="Описание цели..."></textarea></div>
    <div class="fg"><label class="fl">Срок</label>
      <input class="inp" id="g-dl" type="date"/></div>`,
    async () => {
      const t = ($("g-title")?.value || "").trim();
      if (!t) { alert("Введите название"); return; }
      await addGoal({ title: t, desc: $("g-desc")?.value.trim() || "", deadline: $("g-dl")?.value || null });
      toast("Цель создана ✓"); closeModal(); window._refreshAll?.();
    });
}

// ════════════════ PROJECT FORM ════════════════
async function buildProjectModal(title, goalId = null) {
  const goals = await getGoals();
  openModal(title, `
    <div class="fg"><label class="fl">Название проекта *</label>
      <input class="inp" id="p-title" placeholder="Название проекта"/></div>
    <div class="fg"><label class="fl">Цель</label>
      <select class="sel" id="p-goal">
        <option value="">— Без цели —</option>
        ${goals.map(g => `<option value="${g.id}" ${g.id===goalId?"selected":""}>${esc(g.title)}</option>`).join("")}
      </select></div>`,
    async () => {
      const t = ($("p-title")?.value || "").trim();
      if (!t) { alert("Введите название"); return; }
      await addProject({ name: t, goalId: $("p-goal")?.value || null });
      toast("Проект создан ✓"); closeModal(); window._refreshAll?.();
    });
}

// ════════════════ IDEA FORM ════════════════
function buildIdeaModal(title) {
  openModal(title, `
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="i-title" placeholder="Заголовок идеи"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="i-text" placeholder="Опишите идею..." style="min-height:120px"></textarea></div>
    <div class="fg"><label class="fl">Дедлайн (необязательно)</label>
      <input class="inp" id="i-dl" type="datetime-local"/></div>`,
    async () => {
      const t = ($("i-title")?.value || "").trim();
      const x = ($("i-text")?.value  || "").trim();
      if (!t && !x) { alert("Введите текст или заголовок"); return; }
      await addIdea({ title: t, text: x, deadline: toTS($("i-dl")?.value || null) });
      toast("Идея сохранена ✓"); closeModal(); window._refreshAll?.();
    });
}

// ════════════════ DIARY FORM ════════════════
export async function buildDiaryModal(title, tmpl = null, defaultDate = null) {
  const goals = await getGoals();
  const diaryDate = defaultDate ? dstr(new Date(defaultDate)) : today();
  openModal(title, `
    <div class="fg"><label class="fl">Категория</label>
      <select class="sel" id="d-goal">
        <option value="">— Общее —</option>
        ${goals.map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join("")}
      </select></div>
    <div class="fg"><label class="fl">Дата записи</label>
      <input class="inp" id="d-date" type="date" value="${diaryDate}"/></div>
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="d-title" placeholder="Заголовок записи"
        value="${esc(tmpl?.title || "")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="d-text" style="min-height:140px">${esc(tmpl?.text || "")}</textarea></div>`,
    async () => {
      const t  = ($("d-title")?.value || "").trim();
      const tx = ($("d-text")?.value  || "").trim();
      if (!t && !tx) { alert("Введите текст"); return; }
      const now = new Date();
      const p2  = n => String(n).padStart(2,"0");
      await addDiaryEntry({
        title: t, text: tx,
        goalId: $("d-goal")?.value || null,
        time: `${p2(now.getHours())}:${p2(now.getMinutes())}`,
        date: $("d-date")?.value || today()
      });
      toast("Запись сохранена ✓"); closeModal(); window._refreshAll?.();
    });
}

// ════════════════ TEMPLATE FORM ════════════════
function buildTemplateModal(title) {
  openModal(title, `
    <div class="fg"><label class="fl">Название шаблона *</label>
      <input class="inp" id="tp-title" placeholder="Название"/></div>
    <div class="fg"><label class="fl">Текст шаблона</label>
      <textarea class="txta" id="tp-text" style="min-height:130px"
        placeholder="Текст, который подставляется при использовании шаблона..."></textarea></div>`,
    async () => {
      const t = ($("tp-title")?.value || "").trim();
      if (!t) { alert("Введите название"); return; }
      await addTemplate({ title: t, text: ($("tp-text")?.value || "").trim() });
      toast("Шаблон сохранён ✓"); closeModal(); window._refreshAll?.();
    });
}

// ════════════════ EDIT FORMS ════════════════
export async function editTaskModal(id) {
  const [allT, goals, projects] = await Promise.all([
    window._getTasks?.() || [], getGoals(), getProjects()
  ]);
  const t = allT.find(x => x.id === id); if (!t) return;
  const dlVal = t.deadline  ? (t.deadline.toDate  ? t.deadline.toDate()  : new Date(t.deadline)).toISOString().slice(0,16) : "";
  const stVal = t.startDate ? (t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate)).toISOString().slice(0,16) : "";
  const filtP = t.goalId ? projects.filter(p => p.goalId === t.goalId) : projects;
  const taskDate = t.date || today();

  openModal("Редактировать задачу", `
    <div class="fg"><label class="fl">Название</label>
      <input class="inp" id="et-ttl" value="${esc(t.title)}"/></div>
    <div class="fg"><label class="fl">Примечание</label>
      <textarea class="txta" id="et-note">${esc(t.note||"")}</textarea></div>
    <div class="fg"><label class="fl">Цель</label>
      <select class="sel" id="et-goal">
        <option value="">— Корневая —</option>
        ${goals.map(g => `<option value="${g.id}" ${g.id===t.goalId?"selected":""}>${esc(g.title)}</option>`).join("")}
      </select></div>
    <div class="fg"><label class="fl">Проект</label>
      <select class="sel" id="et-proj">
        <option value="">— Без проекта —</option>
        ${filtP.map(p => `<option value="${p.id}" ${p.id===t.projId?"selected":""}>${esc(p.name)}</option>`).join("")}
      </select></div>
    <div class="inp-row">
      <div class="fg" style="flex:1"><label class="fl">Начало</label>
        <input class="inp" type="datetime-local" id="et-st" value="${stVal}"/></div>
      <div class="fg" style="flex:1"><label class="fl">Дедлайн</label>
        <input class="inp" type="datetime-local" id="et-dl" value="${dlVal}"/></div>
    </div>
    <div class="fg"><label class="fl">Дата выполнения</label>
      <input class="inp" type="date" id="et-date" value="${taskDate}"/></div>
    <div class="fg"><label class="fl">Приоритет</label>
      <select class="sel" id="et-pri">
        <option value="high" ${t.priority==="high"?"selected":""}>🔴 Высокий</option>
        <option value="med"  ${(!t.priority||t.priority==="med")?"selected":""}>🟡 Средний</option>
        <option value="low"  ${t.priority==="low"?"selected":""}>🟢 Низкий</option>
      </select></div>
    <div class="m-section"><div class="m-section-ttl">Подзадачи</div>
      <div id="edit-sub-list" class="sub-list">
        ${(t.subtasks || []).map(sub => `
          <div class="sub-row"><input class="inp" value="${esc(sub)}" placeholder="Подзадача"/><button class="rm-sub" onclick="this.closest('.sub-row').remove()">×</button></div>
        `).join("")}
      </div>
      <button class="add-sub" onclick="window._addSub('edit-sub-list')">+ Добавить подзадачу</button>
    </div>
    <div class="modal-footer-btns" style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-cl" style="flex:1;color:var(--red);border-color:rgba(192,64,48,.3)"
        onclick="window._delTask('${id}')">🗑 Удалить задачу</button>
    </div>`,
    async () => {
      const newSubtasks = [...($("#edit-sub-list")?.querySelectorAll("input") || [])].map(i => i.value.trim()).filter(Boolean);
      await updateTask(id, {
        title:     $("#et-ttl").value.trim(),
        note:      $("#et-note").value.trim(),
        goalId:    $("#et-goal").value  || null,
        projId:    $("#et-proj").value  || null,
        priority:  $("#et-pri").value,
        deadline:  $("#et-dl")?.value   || null,
        startDate: $("#et-st")?.value   || null,
        date:      $("#et-date")?.value || today(),
        subtasks:  newSubtasks
      });
      toast("Сохранено ✓"); closeModal(); window._refreshAll?.();
    });
}

export async function editIdeaModal(id) {
  const all = await window._getIdeas?.() || [];
  const x   = all.find(a => a.id === id); if (!x) return;
  openModal("Редактировать идею", `
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="ei-t" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="ei-tx">${esc(x.text||"")}</textarea></div>`,
    async () => {
      await updateIdea(id, { title: $("#ei-t").value.trim(), text: $("#ei-tx").value.trim() });
      toast("Сохранено ✓"); closeModal(); window._refreshAll?.();
    });
}

export async function editDiaryModal(id) {
  const all = await window._getDiary?.() || [];
  const x   = all.find(a => a.id === id); if (!x) return;
  openModal("Редактировать запись", `
    <div class="fg"><label class="fl">Дата записи</label>
      <input class="inp" type="date" id="ed-date" value="${x.date || today()}"/></div>
    <div class="fg"><label class="fl">Заголовок</label>
      <input class="inp" id="ed-t" value="${esc(x.title||"")}"/></div>
    <div class="fg"><label class="fl">Текст</label>
      <textarea class="txta" id="ed-tx" style="min-height:120px">${esc(x.text||"")}</textarea></div>`,
    async () => {
      await updateDiaryEntry(id, { 
        title: $("#ed-t").value.trim(), 
        text: $("#ed-tx").value.trim(),
        date: $("#ed-date").value
      });
      toast("Сохранено ✓"); closeModal(); window._refreshAll?.();
    });
}