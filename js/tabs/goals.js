// ════════════════════════════════════════
//  TAB: ЦЕЛИ — MIND MAP
//  Вариант 4: drag+drop, sidebar-edit, inline rename
//  js/tabs/goals.js
// ════════════════════════════════════════

import { registerTab } from "../router.js";
import { getGoals, getProjects, getTasks, saveMmPos, getMmPos,
         deleteGoal, deleteProject, deleteTask, toggleTask,
         addGoal, addProject, addTask, updateGoal, updateTask,
         esc, dstr, today, getUid } from "../db.js";
import { toast } from "../modal.js";
import { GCOLS } from "../utils.js";

// ════════════ СОСТОЯНИЕ ════════════
let mmTree  = null;
let mmFlat  = [];
let mmPan   = { x:0, y:0 }, mmScale = 1;
let mmSel   = null;       // id выбранной ноды
let eventsSet = false;

// Drag нод
let drag = null;          // { node, startX, startY, moved }

// Drag-to-reparent: нода летит к новому родителю
let reparent = {
  active:   false,
  nodeId:   null,
  ghostEl:  null,         // DOM-призрак
  dropId:   null,         // id ноды под курсором
};

// Форматирование
const nodeColors = new Map();
let fmtLineStyle = "curve";
let fmtLineWidth = "medium";
let fmtNodeShape = "rect";
let fmtShowDone  = true;
let fmtLayout    = "right";

// Размеры нод
const NW = { root:140, goal:160, project:140, task:130 };
const NH = { root:44,  goal:36,  project:30,  task:26  };
const VGAP = 12, HGAP = 56;

// Правила типизации при drop
// Что становится нода когда её бросают на родителя:
// root → goal, goal → project или task, project → task, task → task
const DROP_TYPE = {
  root:    "goal",
  goal:    "project",   // если тащим проект/цель на цель → проект
  project: "task",
  task:    "task",
};

export function initGoals() { registerTab("goals", renderGoals); }

// ════════════════════════════════════════
//  SIDEBAR — панель форматирования (оригинальная)
// ════════════════════════════════════════
function renderSidebar(selNode) {
  const sb = document.getElementById("sb-body");
  if (!sb) return;

  const COLORS = [
    "#C06070","#A07840","#9060A0","#507860",
    "#6060A0","#704040","#407060","#C8963E",
    "#4A8A4A","#3A6EA8","#C04030","#7B4F1E",
    "#5A3510","#A06A2E","#9A6F28","#EAE0C4",
  ];

  sb.innerHTML = `
    <!-- Добавить — наверху -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">✦</span> Добавить</div>
      <div class="fmt-add-btns">
        <button class="fmt-add-btn" onclick="window.openNewModal('goal',null,null,'goals')">+ Цель</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('task',null,null,'goals')">+ Задача</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('project',null,null,'goals')">+ Проект</button>
      </div>
    </div>

    <!-- Заливка -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◉</span> Заливка
        ${!selNode || selNode.type==="root" ? '<span style="font-size:9px;color:var(--tx-l);font-style:italic;font-weight:400;text-transform:none;letter-spacing:0">(выберите элемент)</span>' : ""}
      </div>
      <div class="fmt-color-grid">
        <div class="fmt-color-cell auto ${selNode && !nodeColors.get(selNode.id) ? "sel" : ""}"
          onclick="window._fmtSetColor('')" title="Авто"><span>авто</span></div>
        ${COLORS.map(c => `
          <div class="fmt-color-cell ${selNode && nodeColors.get(selNode.id)===c ? "sel" : ""}"
            style="background:${c}" onclick="window._fmtSetColor('${c}')"></div>`).join("")}
      </div>
    </div>

    <!-- Форма ноды -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">▣</span> Форма</div>
      <div class="fmt-btn-row">
        <button class="fmt-shape-btn ${fmtNodeShape==="rect"?"on":""}" onclick="window._fmtShape('rect')" title="Прямоугольник">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape==="rounded"?"on":""}" onclick="window._fmtShape('rounded')" title="Скруглённый">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape==="pill"?"on":""}" onclick="window._fmtShape('pill')" title="Таблетка">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </div>

    <!-- Ветки -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">⌇</span> Ветки</div>
      <div class="fmt-label">Стиль линий</div>
      <div class="fmt-btn-row">
        <button class="fmt-line-btn ${fmtLineStyle==="curve"?"on":""}" onclick="window._fmtLine('curve')" title="Кривая">
          <svg width="46" height="22"><path d="M4,14 C16,14 30,6 42,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle==="straight"?"on":""}" onclick="window._fmtLine('straight')" title="Прямая">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle==="elbow"?"on":""}" onclick="window._fmtLine('elbow')" title="Угловая">
          <svg width="46" height="22"><polyline points="4,18 20,18 20,4 42,4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="fmt-label" style="margin-top:8px">Толщина</div>
      <div class="fmt-btn-row">
        <button class="fmt-width-btn ${fmtLineWidth==="thin"?"on":""}" onclick="window._fmtWidth('thin')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-width-btn ${fmtLineWidth==="medium"?"on":""}" onclick="window._fmtWidth('medium')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-width-btn ${fmtLineWidth==="thick"?"on":""}" onclick="window._fmtWidth('thick')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <!-- Структура -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">⊞</span> Структура</div>
      <div class="fmt-btn-row">
        <button class="fmt-layout-btn ${fmtLayout==="right"?"on":""}" onclick="window._fmtLayout('right')">
          <svg width="52" height="34" viewBox="0 0 52 34">
            <rect x="2" y="13" width="14" height="8" rx="2" fill="currentColor" opacity=".8"/>
            <line x1="16" y1="17" x2="22" y2="9" stroke="currentColor" stroke-width="1.2"/>
            <line x1="16" y1="17" x2="22" y2="17" stroke="currentColor" stroke-width="1.2"/>
            <line x1="16" y1="17" x2="22" y2="25" stroke="currentColor" stroke-width="1.2"/>
            <rect x="22" y="5" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="22" y="13" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="22" y="21" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
          </svg><span>Вправо</span>
        </button>
        <button class="fmt-layout-btn ${fmtLayout==="down"?"on":""}" onclick="window._fmtLayout('down')">
          <svg width="52" height="34" viewBox="0 0 52 34">
            <rect x="19" y="2" width="14" height="8" rx="2" fill="currentColor" opacity=".8"/>
            <line x1="26" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <line x1="26" y1="10" x2="26" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <line x1="26" y1="10" x2="42" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <rect x="3" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="19" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="35" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
          </svg><span>Вниз</span>
        </button>
      </div>
    </div>

    <!-- Вид -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◎</span> Вид</div>
      <label class="fmt-toggle-row">
        <span class="fmt-toggle-lbl">Показать выполненные</span>
        <button class="fmt-toggle ${fmtShowDone?"on":""}" onclick="window._fmtShowDone()">
          <span class="fmt-toggle-knob"></span>
        </button>
      </label>
    </div>`;
}

// ════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ДЕРЕВА
// ════════════════════════════════════════
function depthOf(node) {
  const types = { root:0, goal:1, project:2, task:3 };
  return types[node.type] ?? 0;
}
function isDescendant(ancestor, childId) {
  function check(n) {
    if (n.id === childId) return true;
    return n.children.some(check);
  }
  return ancestor.children.some(check);
}
function isDirectParent(nodeId, candidateId) {
  const candidate = mmFlat.find(n => n.id === candidateId);
  if (!candidate) return false;
  return candidate.children.some(c => c.id === nodeId);
}
function findParent(nodeId) {
  for (const n of mmFlat) {
    if (n.children.some(c => c.id === nodeId)) return n;
  }
  return null;
}

// ════════════════════════════════════════
//  RENDER GOALS
// ════════════════════════════════════════
export async function renderGoals() {
  document.getElementById("tb-ttl").textContent = "Цели";
  const [goals, projects, allTasks] = await Promise.all([getGoals(), getProjects(), getTasks()]);
  const tasks = fmtShowDone ? allTasks : allTasks.filter(t => !t.done);

  const selNode = mmFlat.find(n => n.id === mmSel) || null;
  if (window._sbStyleTab === undefined) window._sbStyleTab = false;
  renderSidebar(selNode);

  const wrap = document.getElementById("mm-wrap");
  const cw = wrap.offsetWidth || 800;
  const ch = wrap.offsetHeight || 500;

  function makeNode(id, type, label, color, done) {
    return { id, type, label, color, done:!!done,
      w: NW[type]||130, h: NH[type]||28,
      children:[], x:0, y:0, subtreeH:0, subtreeW:0 };
  }

  const root = makeNode("root","root","МОИ ЦЕЛИ",null,false);

  goals.forEach((g, gi) => {
    const dc  = GCOLS[gi % GCOLS.length];
    const gc  = nodeColors.get(g.id) || dc;
    const gn  = makeNode(g.id, "goal", g.title, gc, false);
    projects.filter(p => p.goalId === g.id).forEach(proj => {
      const pc = nodeColors.get(proj.id) || dc;
      const pn = makeNode(proj.id, "project", proj.name, pc, false);
      tasks.filter(t => t.projId === proj.id).forEach(t =>
        pn.children.push(makeNode(t.id,"task",t.title,nodeColors.get(t.id)||dc,t.done)));
      gn.children.push(pn);
    });
    tasks.filter(t => t.goalId===g.id && !t.projId).forEach(t =>
      gn.children.push(makeNode(t.id,"task",t.title,nodeColors.get(t.id)||dc,t.done)));
    root.children.push(gn);
  });
  tasks.filter(t => !t.goalId && !t.projId).forEach(t =>
    root.children.push(makeNode(t.id,"task",t.title,nodeColors.get(t.id)||GCOLS[0],t.done)));

  // Layout
  function calcSize(n) {
    if (!n.children.length) { n.subtreeH=n.h; n.subtreeW=n.w; return; }
    let tH=0, tW=0;
    n.children.forEach((c,i) => {
      calcSize(c);
      const g = i < n.children.length-1 ? VGAP : 0;
      if (fmtLayout==="right") { tH += c.subtreeH+g; tW = Math.max(tW,c.subtreeW); }
      else                     { tW += c.subtreeW+g; tH = Math.max(tH,c.subtreeH); }
    });
    n.subtreeH = fmtLayout==="right" ? Math.max(n.h,tH) : n.h+HGAP+tH;
    n.subtreeW = fmtLayout==="right" ? n.w+HGAP+tW      : Math.max(n.w,tW);
  }
  calcSize(root);

  function layout(n, x, cy) {
    if (fmtLayout==="right") {
      n.x=x; n.y=cy-n.h/2;
      if (!n.children.length) return;
      const cx2=x+n.w+HGAP; let curY=cy-n.subtreeH/2;
      n.children.forEach(c => { layout(c,cx2,curY+c.subtreeH/2); curY+=c.subtreeH+VGAP; });
    } else {
      n.x=cy-n.w/2; n.y=x;
      if (!n.children.length) return;
      const cy2=x+n.h+HGAP; let curX=cy-n.subtreeW/2;
      n.children.forEach(c => { layout(c,cy2,curX+c.subtreeW/2); curX+=c.subtreeW+VGAP; });
    }
  }
  layout(root, 40, fmtLayout==="right" ? ch/2 : cw/2);

  mmFlat=[]; function flatten(n){mmFlat.push(n);n.children.forEach(flatten);} flatten(root);
  mmTree=root;
  drawMM();
  if (!eventsSet) { setupEvents(wrap); eventsSet=true; }
}

// ════════════════════════════════════════
//  DRAW
// ════════════════════════════════════════
function drawMM() {
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  wrap.querySelectorAll(".mm-node").forEach(n=>n.remove());
  const svg = document.getElementById("mm-svg");
  if (!mmTree) { svg.innerHTML=""; return; }

  const lw = { thin:1.2, medium:2, thick:3.5 }[fmtLineWidth]||2;
  let lines="";
  function drawEdges(n) {
    n.children.forEach(c => {
      let x1,y1,x2,y2;
      if (fmtLayout==="right") {
        x1=(n.x+n.w)*mmScale+mmPan.x; y1=(n.y+n.h/2)*mmScale+mmPan.y;
        x2=c.x*mmScale+mmPan.x;       y2=(c.y+c.h/2)*mmScale+mmPan.y;
      } else {
        x1=(n.x+n.w/2)*mmScale+mmPan.x; y1=(n.y+n.h)*mmScale+mmPan.y;
        x2=(c.x+c.w/2)*mmScale+mmPan.x; y2=c.y*mmScale+mmPan.y;
      }
      const raw = c.color && c.color!=="var(--tx-l)" ? c.color : "#7B4F1E";
      const col = c.type==="task" ? raw+"55" : raw+"bb";
      const sw  = c.type==="goal"?lw*1.5:c.type==="project"?lw:lw*0.75;
      const dsh = c.type==="task"?'stroke-dasharray="5,3"':"";
      const mx=(x1+x2)/2, my=(y1+y2)/2;
      let d;
      if (fmtLineStyle==="curve")
        d = fmtLayout==="right"
          ? `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
          : `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      else if (fmtLineStyle==="straight") d=`M${x1},${y1} L${x2},${y2}`;
      else d = fmtLayout==="right"
          ? `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`
          : `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;

      // Подсветка линии к drop-цели
      const isDropTarget = reparent.active && c.id===reparent.dropId;
      lines += `<path d="${d}" stroke="${isDropTarget?"var(--go)":col}"
        stroke-width="${isDropTarget?lw*2:sw}" fill="none" ${dsh}
        stroke-linecap="round" stroke-linejoin="round"/>`;
      drawEdges(c);
    });
  }
  drawEdges(mmTree);
  svg.innerHTML=lines;

  const br={ rect:"4px", rounded:"10px", pill:"999px" }[fmtNodeShape]||"4px";

  function drawNodes(n) {
    const el = document.createElement("div");
    const isDropTarget = reparent.active && n.id===reparent.dropId && n.id!==reparent.nodeId;
    el.className=`mm-node type-${n.type}${n.id===mmSel?" sel":""}${n.done?" done":""}${isDropTarget?" drop-target":""}`;
    el.dataset.id=n.id;
    if (n.type!=="root" && n.color) el.style.setProperty("--nc", n.color);
    if (n.type!=="root") el.style.borderRadius=br;

    // Inline editing: если это выбранная нода и активен inline-edit
    if (n.id===mmSel && window._mmInlineEdit) {
      el.innerHTML=`<input class="mm-inline-input" id="mm-inline-inp" value="${esc(n.label)}"
        onkeydown="if(event.key==='Enter'){event.preventDefault();window._mmSaveInline();}
                   if(event.key==='Escape'){window._mmCancelInline();}"
        onclick="event.stopPropagation()"/>`;
    } else {
      el.innerHTML=`<span class="mm-node-txt">${esc(n.label)}</span>`;
    }

    el.style.cssText+=`left:${n.x*mmScale+mmPan.x}px;top:${n.y*mmScale+mmPan.y}px;width:${n.w*mmScale}px;height:${n.h*mmScale}px;`;
    wrap.appendChild(el);

    // ── Drag start ──
    const onDragStart = (clientX, clientY) => {
      drag = { node:n, startX:clientX, startY:clientY, moved:false };
      reparent.nodeId = n.id;
    };
    el.addEventListener("mousedown", e => { e.stopPropagation(); onDragStart(e.clientX,e.clientY); });
    el.addEventListener("touchstart",e => { e.stopPropagation(); onDragStart(e.touches[0].clientX,e.touches[0].clientY); },{passive:true});

    // ── Клик ──
    el.addEventListener("click", e => {
      e.stopPropagation();
      if (drag?.moved) return;
      window._mmCancelInline?.();
      const wasSel = n.id === mmSel;
      mmSel = wasSel ? null : n.id;
      closeRadial();
      drawMM(); // drawMM сам покажет радиальное меню если mmSel задан
      renderSidebar(mmFlat.find(x => x.id === mmSel) || null);
    });

    // ── Двойной клик → inline rename ──
    el.addEventListener("dblclick", e => {
      e.stopPropagation();
      if (n.type==="root") return;
      mmSel=n.id;
      window._mmInlineEdit=true;
      drawMM();
      setTimeout(()=>{
        const inp=document.getElementById("mm-inline-inp");
        if (inp) { inp.focus(); inp.select(); }
      },30);
    });

    n.children.forEach(drawNodes);

    // После рендера — фокус на inline если нужно
    if (n.id===mmSel && window._mmInlineEdit) {
      setTimeout(()=>{
        const inp=document.getElementById("mm-inline-inp");
        if (inp) { inp.focus(); inp.select(); }
      },30);
    }
  }
  drawNodes(mmTree);

  // Показываем радиальное меню для выбранной ноды — ПОСЛЕ всех нод в DOM
  if (mmSel && !window._mmInlineEdit) {
    const selN = mmFlat.find(n => n.id === mmSel);
    if (selN && selN.type !== "root") {
      // Небольшая задержка чтобы DOM обновился
      requestAnimationFrame(() => showRadial(selN));
    }
  }
}

// ════════════════════════════════════════
//  РАДИАЛЬНОЕ МЕНЮ (Miro-стиль)
// ════════════════════════════════════════
let radialEl = null;

function closeRadial() {
  radialEl?.remove();
  radialEl = null;
}

function showRadial(node) {
  closeRadial();
  const wrap = document.getElementById("mm-wrap");
  if (!wrap) return;

  // Позиция центра ноды на экране
  const nx = node.x * mmScale + mmPan.x;
  const ny = node.y * mmScale + mmPan.y;
  const nw = node.w * mmScale;
  const nh = node.h * mmScale;
  const cx = nx + nw / 2;
  const cy = ny + nh / 2;

  // Кнопки радиального меню в зависимости от типа
  // Формат: { icon, label, action, danger? }
  const BTNS = [];

  // ➕ Добавить дочернюю
  if (node.type === "root") {
    BTNS.push({ icon:"🎯", label:"Цель",    action: () => window.openNewModal("goal",null,null,"goals") });
  } else if (node.type === "goal") {
    BTNS.push({ icon:"📁", label:"Проект",  action: () => window.openNewModal("project",node.id,null,"goals") });
    BTNS.push({ icon:"✅", label:"Задача",  action: () => window.openNewModal("task",node.id,null,"goals") });
  } else if (node.type === "project") {
    BTNS.push({ icon:"✅", label:"Задача",  action: () => window.openNewModal("task",null,node.id,"goals") });
  }

  // ✎ Редактировать
  if (node.type === "task") {
    BTNS.push({ icon:"✎", label:"Изменить", action: () => { closeRadial(); window.editTask(node.id); } });
    BTNS.push({ icon: node.done ? "↩" : "✓", label: node.done ? "Открыть" : "Готово",
      action: async () => { closeRadial(); await toggleTask(node.id); window._refreshAll?.(); } });
  }

  // 🔀 Сменить тип (для не-root)
  if (node.type !== "root") {
    BTNS.push({ icon:"🔀", label:"Тип",     action: () => showTypeMenu(node, cx, cy) });
  }

  // ✕ Удалить
  if (node.type !== "root") {
    BTNS.push({ icon:"✕", label:"Удалить", danger:true,
      action: async () => {
        closeRadial();
        const label = node.type==="goal" ? "цель и все её проекты/задачи"
                    : node.type==="project" ? "проект и все задачи" : "задачу";
        if (!confirm(`Удалить ${label}?`)) return;
        await deleteSubtreeNode(node);
        mmSel = null; window._refreshAll?.();
      }
    });
  }

  // Раскладываем кнопки по кругу
  const R = 52;   // радиус в px
  const total = BTNS.length;
  // Начинаем сверху, идём по часовой
  const startAngle = -Math.PI / 2;

  const menu = document.createElement("div");
  menu.className = "mm-radial-menu";
  menu.style.cssText = `left:${cx}px;top:${cy}px;`;

  BTNS.forEach((btn, i) => {
    const angle = startAngle + (2 * Math.PI * i) / total;
    const bx = Math.round(R * Math.cos(angle));
    const by = Math.round(R * Math.sin(angle));

    const b = document.createElement("button");
    b.className = `mm-radial-btn${btn.danger ? " danger" : ""}`;
    // Позиция: смещение от центра минус половина размера кнопки (23px)
    b.style.cssText = `left:${bx - 23}px;top:${by - 23}px;animation-delay:${i * 25}ms`;
    b.innerHTML = `<span class="mm-rb-icon">${btn.icon}</span><span class="mm-rb-lbl">${btn.label}</span>`;
    b.title = btn.label;
    b.onclick = e => { e.stopPropagation(); btn.action(); };
    menu.appendChild(b);
  });

  wrap.appendChild(menu);
  radialEl = menu;

  // Закрываем при клике вне — игнорируем клики первые 200ms (время открытия)
  const openedAt = Date.now();
  const outsideHandler = (e) => {
    if (Date.now() - openedAt < 200) return;
    if (radialEl && !radialEl.contains(e.target)) {
      closeRadial();
      document.removeEventListener("click", outsideHandler);
    }
  };
  document.addEventListener("click", outsideHandler);
}

// Подменю смены типа
function showTypeMenu(node, cx, cy) {
  closeRadial();
  const wrap = document.getElementById("mm-wrap");
  if (!wrap) return;

  const types = [
    { type:"goal",    icon:"🎯", label:"→ Цель"    },
    { type:"project", icon:"📁", label:"→ Проект"  },
    { type:"task",    icon:"✅", label:"→ Задача"  },
  ].filter(t => t.type !== node.type);

  const menu = document.createElement("div");
  menu.className = "mm-radial-menu";
  menu.style.cssText = `left:${cx}px;top:${cy}px;`;

  const R = 52, total = types.length;
  const startAngle = -Math.PI / 2;
  types.forEach((t, i) => {
    const angle = startAngle + (2 * Math.PI * i) / total;
    const bx = Math.round(R * Math.cos(angle));
    const by = Math.round(R * Math.sin(angle));
    const b = document.createElement("button");
    b.className = "mm-radial-btn";
    b.style.cssText = `left:${bx - 23}px;top:${by - 23}px;animation-delay:${i*25}ms`;
    b.innerHTML = `<span class="mm-rb-icon">${t.icon}</span><span class="mm-rb-lbl">${t.label}</span>`;
    b.onclick = async e => {
      e.stopPropagation();
      closeRadial();
      await changeNodeType(node, t.type);
    };
    menu.appendChild(b);
  });

  // Кнопка «назад» — снизу
  const back = document.createElement("button");
  back.className = "mm-radial-btn";
  back.style.cssText = `left:${-23}px;top:${R - 23}px`;
  back.innerHTML = `<span class="mm-rb-icon">←</span><span class="mm-rb-lbl">Назад</span>`;
  back.onclick = e => { e.stopPropagation(); closeRadial(); showRadial(node); };
  menu.appendChild(back);

  wrap.appendChild(menu);
  radialEl = menu;
  const openedAt2 = Date.now();
  const outsideHandler2 = (e) => {
    if (Date.now() - openedAt2 < 200) return;
    if (radialEl && !radialEl.contains(e.target)) {
      closeRadial();
      document.removeEventListener("click", outsideHandler2);
    }
  };
  document.addEventListener("click", outsideHandler2);
}

// Смена типа через перемещение в дереве
async function changeNodeType(node, newType) {
  // Находим подходящего родителя для нового типа
  let newParentId = null;
  const parent = findParent(node.id);

  if (newType === "goal") {
    newParentId = "root";
  } else if (newType === "project") {
    // Ищем ближайшую цель — родительская или первая доступная
    const goal = parent?.type === "goal" ? parent
               : mmFlat.find(n => n.type === "goal");
    newParentId = goal?.id || "root";
    if (!goal) { newType = "goal"; newParentId = "root"; } // нет целей — делаем целью
  } else { // task
    const proj = parent?.type === "project" ? parent : null;
    const goal = parent?.type === "goal" ? parent : mmFlat.find(n => n.type === "goal");
    newParentId = proj?.id || goal?.id || "root";
  }

  const targetNode = mmFlat.find(n => n.id === newParentId) || mmFlat.find(n => n.type === "root");
  if (targetNode) await doReparent(node, targetNode.id);
}

// Удаление поддерева
async function deleteSubtreeNode(node) {
  async function del(n) {
    for (const c of n.children) await del(c);
    if (n.type==="goal")         await deleteGoal(n.id);
    else if (n.type==="project") await deleteProject(n.id);
    else if (n.type==="task")    await deleteTask(n.id);
  }
  await del(node);
}

// ════════════════════════════════════════
//  СОБЫТИЯ МЫШИ / TOUCH
// ════════════════════════════════════════
function setupEvents(wrap) {
  // Клик на пустое место
  wrap.addEventListener("click", e => {
    if (e.target===wrap || e.target===document.getElementById("mm-svg")) {
      window._mmCancelInline?.();
      closeRadial();
      mmSel=null; drawMM(); renderSidebar(null);
    }
  });

  // Pan по пустому месту
  let panning=false, panStart={x:0,y:0};
  wrap.addEventListener("mousedown", e => {
    if (e.target===wrap || e.target===document.getElementById("mm-svg")) {
      panning=true; panStart={x:e.clientX-mmPan.x, y:e.clientY-mmPan.y};
    }
  });

  // Zoom
  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const ns=Math.max(0.25,Math.min(3,mmScale+(e.deltaY<0?0.1:-0.1)));
    const r=wrap.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    mmPan.x=mx-(mx-mmPan.x)*(ns/mmScale);
    mmPan.y=my-(my-mmPan.y)*(ns/mmScale);
    mmScale=ns; drawMM();
  },{passive:false});

  // Pinch zoom
  let lp=0;
  wrap.addEventListener("touchstart",e=>{
    if (e.touches.length===2)
      lp=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  wrap.addEventListener("touchmove",e=>{
    if (e.touches.length===2&&lp>0){
      e.preventDefault();
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      mmScale=Math.max(0.25,Math.min(3,mmScale*(d/lp))); lp=d; drawMM();
    }
  },{passive:false});

  // Глобальные move/up
  window._mmPanState = { active:false };

  window.addEventListener("mousemove", e => {
    // ── Drag ноды ──
    if (drag) {
      const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;
      if (!drag.moved && (Math.abs(dx)>5||Math.abs(dy)>5)) {
        drag.moved=true;
        reparent.active=true;
        // Создаём призрак
        const ghost=document.createElement("div");
        ghost.className="mm-drag-ghost";
        ghost.textContent=drag.node.label;
        document.body.appendChild(ghost);
        reparent.ghostEl=ghost;
        wrap.style.cursor="grabbing";
      }
      if (drag.moved && reparent.ghostEl) {
        reparent.ghostEl.style.left=e.clientX+10+"px";
        reparent.ghostEl.style.top=e.clientY-14+"px";
        // Ищем ноду под курсором
        const rect=wrap.getBoundingClientRect();
        const mx=(e.clientX-rect.left-mmPan.x)/mmScale;
        const my=(e.clientY-rect.top-mmPan.y)/mmScale;
        let hovered=null;
        for (const n of mmFlat) {
          if (n.id===drag.node.id) continue;
          if (mx>=n.x&&mx<=n.x+n.w&&my>=n.y&&my<=n.y+n.h) { hovered=n; break; }
        }
        const newDropId = hovered?.id||null;
        if (newDropId!==reparent.dropId) { reparent.dropId=newDropId; drawMM(); }
        // Подсказка в призраке
        if (hovered) {
          const newType = DROP_TYPE[hovered.type]||"task";
          reparent.ghostEl.dataset.hint=`→ станет: ${{goal:"Целью",project:"Проектом",task:"Задачей"}[newType]}`;
        } else {
          reparent.ghostEl.dataset.hint="";
        }
      }
      return;
    }
    // ── Pan ──
    if (panning) {
      mmPan={x:e.clientX-panStart.x, y:e.clientY-panStart.y}; drawMM();
    }
  });

  window.addEventListener("mouseup", async e => {
    if (drag?.moved && reparent.dropId) {
      await doReparent(drag.node, reparent.dropId);
    } else if (drag?.moved) {
      // Просто перемещение позиции (без drop-target)
      await saveMmPos(drag.node.id, drag.node.x, drag.node.y);
    }
    cleanupDrag();
    if (panning) { panning=false; wrap.style.cursor=""; }
  });

  window.addEventListener("touchend", async () => {
    if (drag?.moved && reparent.dropId) {
      await doReparent(drag.node, reparent.dropId);
    } else if (drag?.moved) {
      await saveMmPos(drag.node.id, drag.node.x, drag.node.y);
    }
    cleanupDrag(); panning=false;
  });

  // Escape — отмена drag и радиального меню
  window.addEventListener("keydown", e => {
    if (e.key==="Escape") { cleanupDrag(); closeRadial(); window._mmCancelInline?.(); }
  });
}

function cleanupDrag() {
  reparent.ghostEl?.remove();
  reparent={ active:false, nodeId:null, ghostEl:null, dropId:null };
  drag=null;
  document.getElementById("mm-wrap")?.style.removeProperty("cursor");
  drawMM();
}

// ════════════════════════════════════════
//  REPARENT — перемещение с изменением типа
// ════════════════════════════════════════
async function doReparent(node, newParentId) {
  if (node.type==="root") return;
  const newParent=mmFlat.find(n=>n.id===newParentId);
  if (!newParent) return;

  const newType = DROP_TYPE[newParent.type] || "task";
  const { doc, updateDoc, addDoc, deleteDoc, collection } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { db } = await import("../firebase.js");
  const uid = getUid();
  const col = (name) => collection(db,"users",uid,name);
  const ud  = (name,id) => doc(db,"users",uid,name,id);

  try {
    // Если тип не меняется — просто обновляем связи
    if (node.type===newType) {
      if (newType==="goal") {
        // цель → цель: goalId не существует, просто перерисовка
      } else if (newType==="project") {
        const goalId = newParent.type==="goal" ? newParent.id : null;
        if (node.type==="project") await updateDoc(ud("projects",node.id),{goalId});
        // если была task → становится проектом
        else if (node.type==="task") {
          await addDoc(col("projects"),{name:node.label,goalId,desc:"",createdAt:new Date()});
          await deleteDoc(ud("tasks",node.id));
        }
      } else { // task
        const goalId = newParent.type==="goal" ? newParent.id : null;
        const projId = newParent.type==="project" ? newParent.id : null;
        if (node.type==="task") await updateDoc(ud("tasks",node.id),{goalId,projId});
      }
    } else {
      // Тип меняется
      if (newType==="goal") {
        // Всё становится целью
        if (node.type==="project") {
          await addDoc(col("goals"),{title:node.label,desc:"",createdAt:new Date()});
          await deleteDoc(ud("projects",node.id));
        } else if (node.type==="task") {
          await addDoc(col("goals"),{title:node.label,desc:"",createdAt:new Date()});
          await deleteDoc(ud("tasks",node.id));
        }
      } else if (newType==="project") {
        const goalId = newParent.type==="goal" ? newParent.id : null;
        if (node.type==="goal") {
          // Цель → проект
          await addDoc(col("projects"),{name:node.label,goalId,desc:"",createdAt:new Date()});
          await deleteDoc(ud("goals",node.id));
        } else if (node.type==="task") {
          await addDoc(col("projects"),{name:node.label,goalId,desc:"",createdAt:new Date()});
          await deleteDoc(ud("tasks",node.id));
        }
      } else { // task
        const goalId = newParent.type==="goal" ? newParent.id : null;
        const projId = newParent.type==="project" ? newParent.id : null;
        if (node.type==="goal") {
          await addDoc(col("tasks"),{title:node.label,note:"",goalId:null,projId:null,done:false,priority:"med",subtasks:[],date:today(),createdAt:new Date()});
          await deleteDoc(ud("goals",node.id));
        } else if (node.type==="project") {
          await addDoc(col("tasks"),{title:node.label,note:"",goalId,projId:null,done:false,priority:"med",subtasks:[],date:today(),createdAt:new Date()});
          await deleteDoc(ud("projects",node.id));
        }
      }
    }
    toast(`Перемещено ✓`);
    mmSel=null;
    window._refreshAll?.();
  } catch(err) {
    console.error("reparent error:", err);
    toast("Ошибка перемещения");
  }
}

// ════════════════════════════════════════
//  INLINE RENAME
// ════════════════════════════════════════
window._mmInlineEdit = false;
window._mmSaveInline = async () => {
  const inp = document.getElementById("mm-inline-inp");
  if (!inp || !mmSel) return;
  const val = inp.value.trim();
  if (!val) { window._mmCancelInline(); return; }
  const node = mmFlat.find(n=>n.id===mmSel);
  if (!node) return;
  window._mmInlineEdit=false;
  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const { db } = await import("../firebase.js");
    const uid = getUid();
    const colName = node.type==="goal"?"goals":node.type==="project"?"projects":"tasks";
    const field   = node.type==="project"?"name":"title";
    await updateDoc(doc(db,"users",uid,colName,node.id),{[field]:val});
    toast("Переименовано ✓");
    window._refreshAll?.();
  } catch(e) { console.error(e); window._mmCancelInline(); }
};
window._mmCancelInline = () => {
  if (!window._mmInlineEdit) return;
  window._mmInlineEdit=false; drawMM();
};

// ════════════════════════════════════════
//  TOOLBAR + FORMAT
// ════════════════════════════════════════
document.getElementById("mm-reset")?.addEventListener("click",    ()=>{mmPan={x:0,y:0};mmScale=1;drawMM();});
document.getElementById("mm-zoom-in")?.addEventListener("click",  ()=>{mmScale=Math.min(3,mmScale+0.2);drawMM();});
document.getElementById("mm-zoom-out")?.addEventListener("click", ()=>{mmScale=Math.max(0.25,mmScale-0.2);drawMM();});

window._fmtSetColor = c => {
  if (!mmSel) return;
  if (c) nodeColors.set(mmSel,c); else nodeColors.delete(mmSel);
  const node=mmFlat.find(n=>n.id===mmSel);
  if (node) node.color=c||null;
  renderSidebar(node||null); drawMM();
};
window._fmtShape    = s => { fmtNodeShape=s; renderSidebar(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtLine     = s => { fmtLineStyle=s; renderSidebar(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtWidth    = w => { fmtLineWidth=w; renderSidebar(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtLayout   = l => { fmtLayout=l; window._refreshAll?.(); };
window._fmtShowDone = () => { fmtShowDone=!fmtShowDone; window._refreshAll?.(); };

window._mmToggle = async id => { await toggleTask(id); window._refreshAll?.(); };
window._mmDelete = async (id,type) => {
  if (!confirm("Удалить?")) return;
  if (type==="goal") await deleteGoal(id);
  else if (type==="project") await deleteProject(id);
  else await deleteTask(id);
  mmSel=null; window._refreshAll?.();
};
window._selectGoal = id => {
  mmSel=id;
  const node=mmFlat.find(n=>n.id===id);
  if (node) {
    const wrap=document.getElementById("mm-wrap");
    const cw=wrap?.offsetWidth||800, ch=wrap?.offsetHeight||500;
    mmPan.x=cw/2-(node.x+node.w/2)*mmScale;
    mmPan.y=ch/2-(node.y+node.h/2)*mmScale;
  }
  window._sbStyleTab=false;
  drawMM(); renderSidebar(node||null);
};
window.closeMMCtx=()=>{};
