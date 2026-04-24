// ════════════════════════════════════════
//  TAB: ЦЕЛИ — MIND MAP (XMind style)
//  js/tabs/goals.js
// ════════════════════════════════════════

import { registerTab } from "../router.js";
import { getGoals, getProjects, getTasks, getMmPos, saveMmPos,
         deleteGoal, deleteProject, deleteTask, toggleTask, esc } from "../db.js";
import { GCOLS } from "../utils.js";

// ── Состояние ──
let mmTree    = null;
let mmFlat    = [];
let mmPan     = { x:0, y:0 }, mmScale = 1;
let mmPanning = false, mmPanStart = { x:0, y:0 };
let mmSel     = null, mmCtxMenu = null;
let eventsSet = false;

// ── Настройки форматирования ──
const nodeColors = new Map(); // id ноды → цвет (индивидуально)
let fmtLineStyle = "curve";   // curve | straight | elbow
let fmtLineWidth = "medium";  // thin | medium | thick
let fmtNodeShape = "rect";    // rect | rounded | pill
let fmtShowDone  = true;
let fmtLayout    = "right";   // right | down

// ── Размеры нод ──
const NODE_W = { root:140, goal:160, project:140, task:130 };
const NODE_H = { root:44,  goal:36,  project:30,  task:26  };
const V_GAP  = 12;
const H_GAP  = 56;

export function initGoals() { registerTab("goals", renderGoals); }

// ════════════════════════════════════════
//  SIDEBAR — панель форматирования
// ════════════════════════════════════════
function renderFormatPanel(selNode) {
  const sb = document.getElementById("sb-body");

  const COLORS = [
    "#C06070","#A07840","#9060A0","#507860",
    "#6060A0","#704040","#407060","#C8963E",
    "#4A8A4A","#3A6EA8","#C04030","#7B4F1E",
    "#5A3510","#A06A2E","#9A6F28","#EDE3CC",
  ];

  const typeLabel = { root:"Корень", goal:"Цель", project:"Проект", task:"Задача" };

  sb.innerHTML = `
    <!-- Выбранный элемент -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◈</span> Элемент</div>
      <div class="fmt-sel-badge ${selNode ? "active" : ""}">
        ${selNode
          ? `<span class="fmt-sel-type">${typeLabel[selNode.type] || ""}</span>
             <span class="fmt-sel-name">${esc(selNode.label)}</span>`
          : `<span class="fmt-sel-none">Нажмите на элемент карты</span>`}
      </div>
      ${selNode && selNode.type !== "root" ? `
        <div class="fmt-btn-row" style="margin-top:8px">
          ${selNode.type === "goal" ? `
            <button class="fmt-action-btn" onclick="window.openNewModal('task','${selNode.id}',null,'goals')">+ Задача</button>
            <button class="fmt-action-btn" onclick="window.openNewModal('project','${selNode.id}',null,'goals')">+ Проект</button>
          ` : selNode.type === "project" ? `
            <button class="fmt-action-btn" onclick="window.openNewModal('task',null,'${selNode.id}','goals')">+ Задача</button>
          ` : selNode.type === "task" ? `
            <button class="fmt-action-btn" onclick="window.editTask('${selNode.id}')">✎ Изменить</button>
            <button class="fmt-action-btn" onclick="window._mmToggle('${selNode.id}')">${selNode.done ? "↩ Открыть" : "✓ Готово"}</button>
          ` : ""}
          <button class="fmt-action-btn danger" onclick="window._mmDelete('${selNode.id}','${selNode.type}')">✕</button>
        </div>` : ""}
    </div>

    <!-- Заливка -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◉</span> Заливка
        ${!selNode || selNode.type === "root" ? '<span style="font-size:9px;color:var(--tx-l);font-style:italic;font-weight:400;text-transform:none;letter-spacing:0">(выберите элемент)</span>' : ""}
      </div>
      <div class="fmt-color-grid">
        <div class="fmt-color-cell auto ${selNode && !nodeColors.get(selNode.id) ? "sel" : ""}"
          onclick="window._fmtSetColor('')" title="Авто">
          <span>авто</span>
        </div>
        ${COLORS.map(c => `
          <div class="fmt-color-cell ${selNode && nodeColors.get(selNode.id) === c ? "sel" : ""}"
            style="background:${c}" onclick="window._fmtSetColor('${c}')"></div>`).join("")}
      </div>
    </div>

    <!-- Форма ноды -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">▣</span> Форма</div>
      <div class="fmt-btn-row">
        <button class="fmt-shape-btn ${fmtNodeShape === "rect" ? "on" : ""}" onclick="window._fmtShape('rect')" title="Прямоугольник">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape === "rounded" ? "on" : ""}" onclick="window._fmtShape('rounded')" title="Скруглённый">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape === "pill" ? "on" : ""}" onclick="window._fmtShape('pill')" title="Таблетка">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </div>

    <!-- Ветки -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">⌇</span> Ветки</div>
      <div class="fmt-label">Стиль линий</div>
      <div class="fmt-btn-row">
        <button class="fmt-line-btn ${fmtLineStyle === "curve" ? "on" : ""}" onclick="window._fmtLine('curve')" title="Кривая">
          <svg width="46" height="22"><path d="M4,14 C16,14 30,6 42,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle === "straight" ? "on" : ""}" onclick="window._fmtLine('straight')" title="Прямая">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle === "elbow" ? "on" : ""}" onclick="window._fmtLine('elbow')" title="Угловая">
          <svg width="46" height="22"><polyline points="4,18 20,18 20,4 42,4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="fmt-label" style="margin-top:8px">Толщина</div>
      <div class="fmt-btn-row">
        <button class="fmt-width-btn ${fmtLineWidth === "thin" ? "on" : ""}" onclick="window._fmtWidth('thin')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-width-btn ${fmtLineWidth === "medium" ? "on" : ""}" onclick="window._fmtWidth('medium')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-width-btn ${fmtLineWidth === "thick" ? "on" : ""}" onclick="window._fmtWidth('thick')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <!-- Структура -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">⊞</span> Структура</div>
      <div class="fmt-btn-row">
        <button class="fmt-layout-btn ${fmtLayout === "right" ? "on" : ""}" onclick="window._fmtLayout('right')">
          <svg width="52" height="34" viewBox="0 0 52 34">
            <rect x="2" y="13" width="14" height="8" rx="2" fill="currentColor" opacity=".8"/>
            <line x1="16" y1="17" x2="22" y2="9" stroke="currentColor" stroke-width="1.2"/>
            <line x1="16" y1="17" x2="22" y2="17" stroke="currentColor" stroke-width="1.2"/>
            <line x1="16" y1="17" x2="22" y2="25" stroke="currentColor" stroke-width="1.2"/>
            <rect x="22" y="5" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="22" y="13" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="22" y="21" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
          </svg>
          <span>Вправо</span>
        </button>
        <button class="fmt-layout-btn ${fmtLayout === "down" ? "on" : ""}" onclick="window._fmtLayout('down')">
          <svg width="52" height="34" viewBox="0 0 52 34">
            <rect x="19" y="2" width="14" height="8" rx="2" fill="currentColor" opacity=".8"/>
            <line x1="26" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <line x1="26" y1="10" x2="26" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <line x1="26" y1="10" x2="42" y2="20" stroke="currentColor" stroke-width="1.2"/>
            <rect x="3" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="19" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
            <rect x="35" y="20" width="14" height="8" rx="2" fill="currentColor" opacity=".5"/>
          </svg>
          <span>Вниз</span>
        </button>
      </div>
    </div>

    <!-- Вид -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◎</span> Вид</div>
      <label class="fmt-toggle-row">
        <span class="fmt-toggle-lbl">Показать выполненные</span>
        <button class="fmt-toggle ${fmtShowDone ? "on" : ""}" onclick="window._fmtShowDone()">
          <span class="fmt-toggle-knob"></span>
        </button>
      </label>
    </div>

    <!-- Добавить -->
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">✦</span> Добавить</div>
      <div class="fmt-add-btns">
        <button class="fmt-add-btn" onclick="window.openNewModal('goal',null,null,'goals')">+ Цель</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('task',null,null,'goals')">+ Задача</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('project',null,null,'goals')">+ Проект</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════
export async function renderGoals() {
  document.getElementById("tb-ttl").textContent = "Цели";

  const [goals, projects, allTasks] = await Promise.all([
    getGoals(), getProjects(), getTasks()
  ]);

  const tasks = fmtShowDone ? allTasks : allTasks.filter(t => !t.done);
  const selNode = mmFlat.find(n => n.id === mmSel) || null;
  renderFormatPanel(selNode);

  const wrap = document.getElementById("mm-wrap");
  const cw   = wrap.offsetWidth  || 800;
  const ch   = wrap.offsetHeight || 500;

  function makeNode(id, type, label, color, done) {
    return { id, type, label, color, done: !!done,
      w: NODE_W[type] || 130, h: NODE_H[type] || 28,
      children: [], x:0, y:0, subtreeH:0, subtreeW:0 };
  }

  const root = makeNode("root", "root", "МОИ ЦЕЛИ", null, false);

  goals.forEach((g, gi) => {
    const defaultCol = GCOLS[gi % GCOLS.length];
    const goalCol    = nodeColors.get(g.id) || defaultCol;
    const goalNode   = makeNode(g.id, "goal", g.title, goalCol, false);

    projects.filter(p => p.goalId === g.id).forEach(proj => {
      const projCol  = nodeColors.get(proj.id) || defaultCol;
      const projNode = makeNode(proj.id, "project", proj.name, projCol, false);
      tasks.filter(t => t.projId === proj.id).forEach(t => {
        const tCol = nodeColors.get(t.id) || defaultCol;
        projNode.children.push(makeNode(t.id, "task", t.title, tCol, t.done));
      });
      goalNode.children.push(projNode);
    });

    tasks.filter(t => t.goalId === g.id && !t.projId).forEach(t => {
      const tCol = nodeColors.get(t.id) || defaultCol;
      goalNode.children.push(makeNode(t.id, "task", t.title, tCol, t.done));
    });

    root.children.push(goalNode);
  });

  tasks.filter(t => !t.goalId && !t.projId).forEach(t =>
    root.children.push(makeNode(t.id, "task", t.title, GCOLS[0], t.done)));

  // Layout
  function calcSize(node) {
    if (!node.children.length) { node.subtreeH = node.h; node.subtreeW = node.w; return; }
    let totalH = 0, totalW = 0;
    node.children.forEach((c, i) => {
      calcSize(c);
      const gap = i < node.children.length - 1 ? V_GAP : 0;
      if (fmtLayout === "right") {
        totalH += c.subtreeH + gap;
        totalW  = Math.max(totalW, c.subtreeW);
      } else {
        totalW += c.subtreeW + gap;
        totalH  = Math.max(totalH, c.subtreeH);
      }
    });
    node.subtreeH = fmtLayout === "right" ? Math.max(node.h, totalH) : node.h + H_GAP + totalH;
    node.subtreeW = fmtLayout === "right" ? node.w + H_GAP + totalW  : Math.max(node.w, totalW);
  }
  calcSize(root);

  function layout(node, x, cy) {
    if (fmtLayout === "right") {
      node.x = x; node.y = cy - node.h / 2;
      if (!node.children.length) return;
      const cx2 = x + node.w + H_GAP;
      let curY = cy - node.subtreeH / 2;
      node.children.forEach(child => {
        layout(child, cx2, curY + child.subtreeH / 2);
        curY += child.subtreeH + V_GAP;
      });
    } else {
      node.x = cy - node.w / 2; node.y = x;
      if (!node.children.length) return;
      const cy2 = x + node.h + H_GAP;
      let curX = cy - node.subtreeW / 2;
      node.children.forEach(child => {
        layout(child, cy2, curX + child.subtreeW / 2);
        curX += child.subtreeW + V_GAP;
      });
    }
  }

  layout(root, 40, fmtLayout === "right" ? ch / 2 : cw / 2);

  mmFlat = [];
  function flatten(n) { mmFlat.push(n); n.children.forEach(flatten); }
  flatten(root);
  mmTree = root;

  drawMM();
  if (!eventsSet) { setupEvents(wrap); eventsSet = true; }
}

// ════════════════════════════════════════
//  DRAW
// ════════════════════════════════════════
function drawMM() {
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  wrap.querySelectorAll(".mm-node").forEach(n => n.remove());
  const svg = document.getElementById("mm-svg");
  if (!mmTree) { svg.innerHTML = ""; return; }

  const lw = { thin:1.2, medium:2, thick:3.5 }[fmtLineWidth] || 2;
  let lines = "";

  function drawEdges(node) {
    node.children.forEach(child => {
      let x1, y1, x2, y2;
      if (fmtLayout === "right") {
        x1 = (node.x + node.w) * mmScale + mmPan.x;
        y1 = (node.y + node.h / 2) * mmScale + mmPan.y;
        x2 = child.x * mmScale + mmPan.x;
        y2 = (child.y + child.h / 2) * mmScale + mmPan.y;
      } else {
        x1 = (node.x + node.w / 2) * mmScale + mmPan.x;
        y1 = (node.y + node.h) * mmScale + mmPan.y;
        x2 = (child.x + child.w / 2) * mmScale + mmPan.x;
        y2 = child.y * mmScale + mmPan.y;
      }

      const rawCol = child.color && child.color !== "var(--tx-l)" ? child.color : "#7B4F1E";
      const col    = child.type === "task" ? rawCol + "55" : rawCol + "bb";
      const sw     = child.type === "goal" ? lw * 1.5 : child.type === "project" ? lw : lw * 0.75;
      const dash   = child.type === "task" ? 'stroke-dasharray="5,3"' : "";
      const mx     = (x1 + x2) / 2, my = (y1 + y2) / 2;

      let d;
      if (fmtLineStyle === "curve")
        d = fmtLayout === "right"
          ? `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
          : `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      else if (fmtLineStyle === "straight")
        d = `M${x1},${y1} L${x2},${y2}`;
      else
        d = fmtLayout === "right"
          ? `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`
          : `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;

      lines += `<path d="${d}" stroke="${col}" stroke-width="${sw}"
        fill="none" ${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
      drawEdges(child);
    });
  }
  drawEdges(mmTree);
  svg.innerHTML = lines;

  const br = { rect:"4px", rounded:"10px", pill:"999px" }[fmtNodeShape] || "4px";

  function drawNodes(node) {
    const el = document.createElement("div");
    el.className = `mm-node type-${node.type}${node.id === mmSel ? " sel" : ""}${node.done ? " done" : ""}`;
    el.dataset.id = node.id;
    if (node.type !== "root" && node.color) el.style.setProperty("--nc", node.color);
    if (node.type !== "root") el.style.borderRadius = br;
    el.innerHTML = `<span class="mm-node-txt">${esc(node.label)}</span>`;
    el.style.cssText += `left:${node.x*mmScale+mmPan.x}px;top:${node.y*mmScale+mmPan.y}px;width:${node.w*mmScale}px;height:${node.h*mmScale}px;`;
    wrap.appendChild(el);

    el.addEventListener("mousedown",  e => { e.stopPropagation(); startPan(e); });
    el.addEventListener("touchstart", e => { e.stopPropagation(); startPan(e.touches[0]); }, { passive:true });
    el.addEventListener("click",      e => { e.stopPropagation(); selectNode(node, e); });
    el.addEventListener("dblclick",   e => { e.stopPropagation(); addChildOf(node); });

    node.children.forEach(drawNodes);
  }
  drawNodes(mmTree);
}

function startPan(e) {
  mmPanning  = true;
  mmPanStart = { x: e.clientX - mmPan.x, y: e.clientY - mmPan.y };
}

function selectNode(node, e) {
  closeCtx();
  mmSel = node.id === mmSel ? null : node.id;
  drawMM();
  renderFormatPanel(mmFlat.find(n => n.id === mmSel) || null);
}

function addChildOf(parent) {
  if      (parent.type === "root")    window.openNewModal("goal",    null,       null,       "goals");
  else if (parent.type === "goal")    window.openNewModal("task",    parent.id,  null,       "goals");
  else if (parent.type === "project") window.openNewModal("task",    null,       parent.id,  "goals");
  else                                window.editTask(parent.id);
}

function showCtx(cx, cy, node) {
  closeCtx();
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "mm-ctx-menu"; menu.id = "mm-ctx";
  menu.style.left = (cx - rect.left) + "px";
  menu.style.top  = (cy - rect.top)  + "px";

  const items = !node ? [
    ["+ Задача",  () => window.openNewModal("task",    null, null, "goals")],
    ["+ Цель",    () => window.openNewModal("goal",    null, null, "goals")],
    ["+ Проект",  () => window.openNewModal("project", null, null, "goals")],
  ] : node.type === "root" ? [
    ["+ Добавить цель", () => window.openNewModal("goal", null, null, "goals")],
  ] : node.type === "goal" ? [
    ["+ Задача",       () => window.openNewModal("task",    node.id, null, "goals")],
    ["+ Проект",       () => window.openNewModal("project", node.id, null, "goals")],
    ["✕ Удалить цель", async () => { if (confirm("Удалить цель?")) { await deleteGoal(node.id); window._refreshAll?.(); } }, true],
  ] : node.type === "project" ? [
    ["+ Задача",           () => window.openNewModal("task", null, node.id, "goals")],
    ["✕ Удалить проект",   async () => { if (confirm("Удалить проект?")) { await deleteProject(node.id); window._refreshAll?.(); } }, true],
  ] : [
    ["✎ Редактировать",  () => window.editTask(node.id)],
    [`✓ ${node.done ? "Открыть" : "Выполнить"}`, async () => { await toggleTask(node.id); window._refreshAll?.(); }],
    ["✕ Удалить задачу", async () => { if (confirm("Удалить?")) { await deleteTask(node.id); window._refreshAll?.(); } }, true],
  ];

  menu.innerHTML = items.map(([l,, d]) =>
    `<button class="mm-ctx-item${d ? " danger" : ""}">${l}</button>`).join("");
  menu.querySelectorAll(".mm-ctx-item").forEach((b, i) =>
    b.onclick = () => { closeCtx(); items[i][1](); });
  wrap.appendChild(menu);
  mmCtxMenu = menu;
  setTimeout(() => document.addEventListener("click", outsideClose), 50);
}

function outsideClose(e) {
  if (mmCtxMenu && !mmCtxMenu.contains(e.target)) {
    closeCtx(); document.removeEventListener("click", outsideClose);
  }
}
function closeCtx() { mmCtxMenu?.remove(); mmCtxMenu = null; }

function setupEvents(wrap) {
  wrap.addEventListener("click", e => {
    if (e.target === wrap || e.target === document.getElementById("mm-svg")) {
      closeCtx(); mmSel = null; drawMM(); renderFormatPanel(null);
      showCtx(e.clientX, e.clientY, null);
    }
  });
  wrap.addEventListener("mousedown", e => {
    if (e.target === wrap || e.target === document.getElementById("mm-svg")) startPan(e);
  });
  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const ns = Math.max(0.25, Math.min(3, mmScale + (e.deltaY < 0 ? 0.1 : -0.1)));
    const r  = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    mmPan.x  = mx - (mx - mmPan.x) * (ns / mmScale);
    mmPan.y  = my - (my - mmPan.y) * (ns / mmScale);
    mmScale  = ns; drawMM();
  }, { passive:false });

  let lp = 0;
  wrap.addEventListener("touchstart", e => {
    if (e.touches.length === 2)
      lp = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive:true });
  wrap.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && lp > 0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      mmScale = Math.max(0.25, Math.min(3, mmScale * (d / lp))); lp = d; drawMM();
    }
  }, { passive:false });
}

window.addEventListener("mousemove", e => {
  if (mmPanning) { mmPan = { x: e.clientX - mmPanStart.x, y: e.clientY - mmPanStart.y }; drawMM(); }
});
window.addEventListener("mouseup",  () => {
  if (mmPanning) { mmPanning = false; const w = document.getElementById("mm-wrap"); if (w) w.style.cursor = ""; }
});
window.addEventListener("touchend", () => { mmPanning = false; });

document.getElementById("mm-reset")?.addEventListener("click",    () => { mmPan = {x:0,y:0}; mmScale = 1; drawMM(); });
document.getElementById("mm-zoom-in")?.addEventListener("click",  () => { mmScale = Math.min(3, mmScale + 0.2); drawMM(); });
document.getElementById("mm-zoom-out")?.addEventListener("click", () => { mmScale = Math.max(0.25, mmScale - 0.2); drawMM(); });

// ── Форматирование ──
window._fmtSetColor = c => {
  if (!mmSel) return; // нет выбранной ноды — ничего не делаем
  if (c) nodeColors.set(mmSel, c);
  else   nodeColors.delete(mmSel);
  // Обновляем цвет в mmFlat без полного рендера дерева
  const node = mmFlat.find(n => n.id === mmSel);
  if (node) node.color = c || null;
  renderFormatPanel(node || null);
  drawMM();
};
window._fmtShape     = s  => { fmtNodeShape = s; renderFormatPanel(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtLine      = s  => { fmtLineStyle = s; renderFormatPanel(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtWidth     = w  => { fmtLineWidth = w; renderFormatPanel(mmFlat.find(n=>n.id===mmSel)||null); drawMM(); };
window._fmtLayout    = l  => { fmtLayout = l; window._refreshAll?.(); };
window._fmtShowDone  = () => { fmtShowDone = !fmtShowDone; window._refreshAll?.(); };

window._mmToggle = async id => { await toggleTask(id); window._refreshAll?.(); };
window._mmDelete = async (id, type) => {
  if (!confirm("Удалить?")) return;
  if (type === "goal")    await deleteGoal(id);
  else if (type === "project") await deleteProject(id);
  else await deleteTask(id);
  mmSel = null; window._refreshAll?.();
};
window._selectGoal = id => {
  mmSel = id;
  const node = mmFlat.find(n => n.id === id);
  if (node) {
    const wrap = document.getElementById("mm-wrap");
    const cw = wrap?.offsetWidth || 800, ch = wrap?.offsetHeight || 500;
    mmPan.x = cw / 2 - (node.x + node.w / 2) * mmScale;
    mmPan.y = ch / 2 - (node.y + node.h / 2) * mmScale;
  }
  drawMM(); renderFormatPanel(node || null);
};
window.closeMMCtx = closeCtx;
