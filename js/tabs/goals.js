// ════════════════════════════════════════
//  TAB: ЦЕЛИ — MIND MAP (стиль XMind)
//  js/tabs/goals.js
// ════════════════════════════════════════

import { registerTab } from "../router.js";
import { getGoals, getProjects, getTasks, getMmPos, saveMmPos,
         deleteGoal, deleteProject, deleteTask, toggleTask, esc } from "../db.js";
import { GCOLS } from "../utils.js";

// ── Состояние ──
let mmTree    = null;   // корневой узел дерева
let mmFlat    = [];     // плоский список всех узлов для drag
let mmDrag    = null, mmDragOff = { x:0, y:0 };
let mmPan     = { x:0, y:0 }, mmScale = 1;
let mmPanning = false, mmPanStart = { x:0, y:0 };
let mmSel     = null, mmCtxMenu = null;
let eventsSet = false;

// ── Размеры нод (логические, до scale) ──
const NODE_W   = { root:140, goal:160, project:140, task:130 };
const NODE_H   = { root:44,  goal:36,  project:30,  task:26  };
const V_GAP    = 10;   // вертикальный зазор между сиблингами
const H_GAP    = 60;   // горизонтальный отступ между уровнями

export function initGoals() {
  registerTab("goals", renderGoals);
}

export async function renderGoals() {
  document.getElementById("tb-ttl").textContent = "Цели";

  const [goals, projects, tasks, posArr] = await Promise.all([
    getGoals(), getProjects(), getTasks(), getMmPos()
  ]);

  // ── Sidebar: список целей ──
  const sb = document.getElementById("sb-body");
  sb.innerHTML = `
    <div class="sb-sec">Мои цели</div>
    ${goals.length ? goals.map((g, i) => `
      <div class="goal-pill" style="background:${GCOLS[i % GCOLS.length]}"
        onclick="window._selectGoal('${g.id}')">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.title)}</span>
        <span class="gp-cnt">${tasks.filter(t => t.goalId === g.id).length}</span>
      </div>`).join("")
    : '<p style="font-size:11px;color:var(--tx-l);padding:4px 0">Нет целей</p>'}
    <button class="sb-new" style="margin-top:10px"
      onclick="window.openNewModal('goal',null,null,'goals')">+ Новая цель</button>`;

  // ════════════════════════════════════════
  //  СТРОИМ ДЕРЕВО
  // ════════════════════════════════════════
  const wrap = document.getElementById("mm-wrap");
  const cw   = wrap.offsetWidth  || 800;
  const ch   = wrap.offsetHeight || 500;

  // Каждый узел: { id, type, label, color?, done?, children[], w, h, x, y, subtreeH }
  function makeNode(id, type, label, color, done) {
    return { id, type, label, color, done: !!done,
      w: NODE_W[type] || 130, h: NODE_H[type] || 28,
      children: [], x: 0, y: 0, subtreeH: 0 };
  }

  const root = makeNode("root", "root", "МОИ ЦЕЛИ", null, false);

  goals.forEach((g, gi) => {
    const goalNode = makeNode(g.id, "goal", g.title, GCOLS[gi % GCOLS.length], false);

    // Проекты под целью
    projects.filter(p => p.goalId === g.id).forEach(proj => {
      const projNode = makeNode(proj.id, "project", proj.name, GCOLS[gi % GCOLS.length], false);

      // Задачи под проектом
      tasks.filter(t => t.projId === proj.id).forEach(t => {
        projNode.children.push(makeNode(t.id, "task", t.title, GCOLS[gi % GCOLS.length], t.done));
      });
      goalNode.children.push(projNode);
    });

    // Задачи напрямую под целью (без проекта)
    tasks.filter(t => t.goalId === g.id && !t.projId).forEach(t => {
      goalNode.children.push(makeNode(t.id, "task", t.title, GCOLS[gi % GCOLS.length], t.done));
    });

    root.children.push(goalNode);
  });

  // Задачи без цели
  tasks.filter(t => !t.goalId && !t.projId).forEach(t => {
    root.children.push(makeNode(t.id, "task", t.title, "var(--tx-l)", t.done));
  });

  // ════════════════════════════════════════
  //  ВЫЧИСЛЯЕМ РАЗМЕРЫ ПОДДЕРЕВЬЕВ
  // ════════════════════════════════════════
  function calcSubtreeH(node) {
    if (!node.children.length) {
      node.subtreeH = node.h;
      return node.subtreeH;
    }
    let total = 0;
    node.children.forEach((c, i) => {
      total += calcSubtreeH(c);
      if (i < node.children.length - 1) total += V_GAP;
    });
    node.subtreeH = Math.max(node.h, total);
    return node.subtreeH;
  }
  calcSubtreeH(root);

  // ════════════════════════════════════════
  //  РАССТАВЛЯЕМ ПОЗИЦИИ
  //  Корень — слева по центру, ветви — вправо
  // ════════════════════════════════════════
  function layoutTree(node, x, centerY) {
    node.x = x;
    node.y = centerY - node.h / 2;

    if (!node.children.length) return;

    const childX = x + node.w + H_GAP;
    let curY = centerY - node.subtreeH / 2;

    node.children.forEach(child => {
      const childCY = curY + child.subtreeH / 2;
      layoutTree(child, childX, childCY);
      curY += child.subtreeH + V_GAP;
    });
  }

  // Стартовая позиция корня — левый центр с отступом
  const startX = 40;
  const startY = ch / 2;
  layoutTree(root, startX, startY);

  // ── Плоский список для drag ──
  mmFlat = [];
  function flatten(node) { mmFlat.push(node); node.children.forEach(flatten); }
  flatten(root);
  mmTree = root;

  drawMM();
  if (!eventsSet) { setupEvents(wrap); eventsSet = true; }
}

// ════════════════════════════════════════
//  РИСУЕМ
// ════════════════════════════════════════
function drawMM() {
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  wrap.querySelectorAll(".mm-node").forEach(n => n.remove());
  const svg = document.getElementById("mm-svg");
  if (!mmTree) { svg.innerHTML = ""; return; }

  // ── SVG соединения ──
  let lines = "";

  function drawEdges(node) {
    node.children.forEach(child => {
      // Точки выхода/входа: правый центр родителя → левый центр ребёнка
      const x1 = (node.x + node.w) * mmScale + mmPan.x;
      const y1 = (node.y + node.h / 2) * mmScale + mmPan.y;
      const x2 = child.x * mmScale + mmPan.x;
      const y2 = (child.y + child.h / 2) * mmScale + mmPan.y;
      const mx  = (x1 + x2) / 2;

      // Цвет и стиль ветки зависит от типа ребёнка
      const col  = child.type === "task"
        ? "rgba(123,79,30,.25)"
        : (child.color || "rgba(123,79,30,.6)");
      const sw   = child.type === "root" ? 3
                 : child.type === "goal" ? 2.5
                 : child.type === "project" ? 2
                 : 1.5;
      const dash = child.type === "task" ? 'stroke-dasharray="5,3"' : "";

      // Плавная S-кривая (кубический безье)
      lines += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"
        stroke="${col}" stroke-width="${sw}" fill="none" ${dash}
        stroke-linecap="round"/>`;

      drawEdges(child);
    });
  }
  drawEdges(mmTree);
  svg.innerHTML = lines;

  // ── DOM-ноды ──
  function drawNodes(node) {
    const el = document.createElement("div");
    const isSel = node.id === mmSel;

    el.className = `mm-node type-${node.type}${isSel ? " sel" : ""}${node.done ? " done" : ""}`;
    el.dataset.id = node.id;

    // XMind-стиль: цветная левая полоса для goal/project/task
    if (node.type !== "root" && node.color) {
      el.style.setProperty("--nc", node.color);
    }

    // Текст внутри ноды
    el.innerHTML = `<span class="mm-node-txt">${esc(node.label)}</span>`;

    el.style.left     = (node.x * mmScale + mmPan.x) + "px";
    el.style.top      = (node.y * mmScale + mmPan.y) + "px";
    el.style.width    = (node.w * mmScale) + "px";
    el.style.height   = (node.h * mmScale) + "px";

    wrap.appendChild(el);

    el.addEventListener("mousedown",  e => { e.stopPropagation(); startDrag(e, node); });
    el.addEventListener("touchstart", e => { e.stopPropagation(); startDrag(e.touches[0], node); }, { passive: true });
    el.addEventListener("click",      e => { e.stopPropagation(); selectNode(node, e); });
    el.addEventListener("dblclick",   e => { e.stopPropagation(); addChildOf(node); });

    node.children.forEach(drawNodes);
  }
  drawNodes(mmTree);
}

function startDrag(e, node) {
  // Drag перемещает всё поддерево — смещаем только сам узел,
  // но из-за layout дерево перестраивается. Для простоты — pan всей карты.
  mmDrag    = null;
  mmPanning = true;
  mmPanStart = { x: e.clientX - mmPan.x, y: e.clientY - mmPan.y };
}

function selectNode(node, e) {
  closeCtx();
  mmSel = node.id === mmSel ? null : node.id;
  drawMM();
  if (mmSel) showCtx(e.clientX, e.clientY, node);
}

function addChildOf(parent) {
  if      (parent.type === "root")    window.openNewModal("goal",    null,      null,       "goals");
  else if (parent.type === "goal")    window.openNewModal("task",    parent.id, null,       "goals");
  else if (parent.type === "project") window.openNewModal("task",    null,      parent.id,  "goals");
  else                                window.editTask(parent.id);
}

// ════════════════════════════════════════
//  КОНТЕКСТНОЕ МЕНЮ
// ════════════════════════════════════════
function showCtx(cx, cy, node) {
  closeCtx();
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  const rect  = wrap.getBoundingClientRect();
  const menu  = document.createElement("div");
  menu.className = "mm-ctx-menu"; menu.id = "mm-ctx";

  // Позиционируем чтобы не вылезало за экран
  let left = cx - rect.left;
  let top  = cy - rect.top;
  menu.style.left = left + "px";
  menu.style.top  = top  + "px";

  const items = !node ? [
    ["+ Задача",  () => window.openNewModal("task",    null, null, "goals")],
    ["+ Цель",    () => window.openNewModal("goal",    null, null, "goals")],
    ["+ Проект",  () => window.openNewModal("project", null, null, "goals")],
  ] : node.type === "root" ? [
    ["+ Добавить цель", () => window.openNewModal("goal", null, null, "goals")],
  ] : node.type === "goal" ? [
    ["+ Задача",         () => window.openNewModal("task",    node.id, null, "goals")],
    ["+ Проект",         () => window.openNewModal("project", node.id, null, "goals")],
    ["✕ Удалить цель",   async () => { if (confirm("Удалить цель?")) { await deleteGoal(node.id); window._refreshAll?.(); } }, true],
  ] : node.type === "project" ? [
    ["+ Задача",          () => window.openNewModal("task", null, node.id, "goals")],
    ["✕ Удалить проект",  async () => { if (confirm("Удалить проект?")) { await deleteProject(node.id); window._refreshAll?.(); } }, true],
  ] : /* task */ [
    ["✎ Редактировать",   () => window.editTask(node.id)],
    [`✓ ${node.done ? "Открыть" : "Выполнить"}`, async () => { await toggleTask(node.id); window._refreshAll?.(); }],
    ["✕ Удалить задачу",  async () => { if (confirm("Удалить?")) { await deleteTask(node.id); window._refreshAll?.(); } }, true],
  ];

  menu.innerHTML = items.map(([label,, danger]) =>
    `<button class="mm-ctx-item${danger ? " danger" : ""}">${label}</button>`
  ).join("");
  menu.querySelectorAll(".mm-ctx-item").forEach((btn, i) =>
    btn.onclick = () => { closeCtx(); items[i][1](); }
  );
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

// ════════════════════════════════════════
//  СОБЫТИЯ КАНВАСА
// ════════════════════════════════════════
function setupEvents(wrap) {
  wrap.addEventListener("click", e => {
    if (e.target === wrap || e.target === document.getElementById("mm-svg")) {
      closeCtx(); mmSel = null; drawMM();
      showCtx(e.clientX, e.clientY, null);
    }
  });

  wrap.addEventListener("mousedown", e => {
    if (e.target === wrap || e.target === document.getElementById("mm-svg")) {
      mmPanning  = true;
      mmPanStart = { x: e.clientX - mmPan.x, y: e.clientY - mmPan.y };
      wrap.style.cursor = "grabbing";
    }
  });

  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const delta    = e.deltaY < 0 ? 0.1 : -0.1;
    const newScale = Math.max(0.25, Math.min(3, mmScale + delta));
    const rect     = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    mmPan.x  = mx - (mx - mmPan.x) * (newScale / mmScale);
    mmPan.y  = my - (my - mmPan.y) * (newScale / mmScale);
    mmScale  = newScale; drawMM();
  }, { passive: false });

  let lastPinch = 0;
  wrap.addEventListener("touchstart", e => {
    if (e.touches.length === 2)
      lastPinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  wrap.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && lastPinch > 0) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
      mmScale = Math.max(0.25, Math.min(3, mmScale * (d / lastPinch)));
      lastPinch = d; drawMM();
    }
  }, { passive: false });
}

// ── Глобальные обработчики мыши ──
window.addEventListener("mousemove", e => {
  if (mmPanning) {
    mmPan = { x: e.clientX - mmPanStart.x, y: e.clientY - mmPanStart.y };
    drawMM();
  }
});
window.addEventListener("mouseup", () => {
  if (mmPanning) {
    mmPanning = false;
    const w = document.getElementById("mm-wrap"); if (w) w.style.cursor = "";
  }
  mmDrag = null;
});
window.addEventListener("touchend", () => { mmDrag = null; });

// ── Кнопки тулбара ──
document.getElementById("mm-reset")?.addEventListener("click",    () => { mmPan = { x: 0, y: 0 }; mmScale = 1; drawMM(); });
document.getElementById("mm-zoom-in")?.addEventListener("click",  () => { mmScale = Math.min(3, mmScale + 0.2); drawMM(); });
document.getElementById("mm-zoom-out")?.addEventListener("click", () => { mmScale = Math.max(0.25, mmScale - 0.2); drawMM(); });

// ── Клик по цели в sidebar ──
window._selectGoal = id => {
  mmSel = id;
  const node = mmFlat.find(n => n.id === id);
  if (node) {
    // Центрируем вид на выбранной цели
    const wrap = document.getElementById("mm-wrap");
    const cw = wrap?.offsetWidth || 800;
    const ch = wrap?.offsetHeight || 500;
    mmPan.x = cw / 2 - (node.x + node.w / 2) * mmScale;
    mmPan.y = ch / 2 - (node.y + node.h / 2) * mmScale;
  }
  drawMM();
};
window.closeMMCtx = closeCtx;
