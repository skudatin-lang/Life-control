// ════════════════════════════════════════
//  TAB: ЦЕЛИ — MIND MAP
//  js/tabs/goals.js
// ════════════════════════════════════════

import { registerTab } from "../router.js";
import { getGoals, getProjects, getTasks, getMmPos, saveMmPos,
         deleteGoal, deleteProject, deleteTask, toggleTask, esc } from "../db.js";
import { GCOLS } from "../utils.js";

let mmNodes   = [], mmEdges = [];
let mmDrag    = null, mmDragOff = { x:0, y:0 };
let mmPan     = { x:0, y:0 }, mmScale = 1;
let mmPanning = false, mmPanStart = { x:0, y:0 };
let mmSel     = null, mmCtxMenu = null;
let eventsSet = false;

export function initGoals() {
  registerTab("goals", renderGoals);
}

export async function renderGoals() {
  document.getElementById("tb-ttl").textContent = "Цели";

  const [goals, projects, tasks, posArr] = await Promise.all([
    getGoals(), getProjects(), getTasks(), getMmPos()
  ]);

  // ── Sidebar: goals list ──
  const sb = document.getElementById("sb-body");
  sb.innerHTML = `
    <div class="sb-sec">Мои цели</div>
    ${goals.length ? goals.map((g,i) => `
      <div class="goal-pill" style="background:${GCOLS[i%GCOLS.length]}"
        onclick="window._selectGoal('${g.id}')">
        ${esc(g.title)}
        <span class="gp-cnt">${tasks.filter(t=>t.goalId===g.id).length}</span>
      </div>`).join("") : '<p style="font-size:11px;color:var(--tx-l)">Нет целей</p>'}
    <button class="sb-new" style="margin-top:10px"
      onclick="window.openNewModal('goal',null,null,'goals')">+ Новая цель</button>`;

  // ── Build node tree ──
  const wrap = document.getElementById("mm-wrap");
  const cw   = wrap.offsetWidth  || 600;
  const ch   = wrap.offsetHeight || 400;
  const posMap = {};
  posArr.forEach(p => { posMap[p.nid] = { x: p.x, y: p.y }; });

  mmNodes = [];
  mmEdges = [];

  // Root node
  mmNodes.push({
    id:"root", type:"root", label:"МОИ ЦЕЛИ",
    x: posMap["root"]?.x ?? cw/2-65,
    y: posMap["root"]?.y ?? ch/2-25,
    w:130, h:50
  });

  goals.forEach((g, gi) => {
    const angle = (2*Math.PI*gi / Math.max(goals.length,1)) - Math.PI/2;
    const r     = Math.min(cw, ch) * 0.28;
    const def   = { x: cw/2 + r*Math.cos(angle) - 60, y: ch/2 + r*Math.sin(angle) - 18 };
    const pos   = posMap[g.id] || def;
    mmNodes.push({ id:g.id, type:"goal", label:g.title, color:GCOLS[gi%GCOLS.length],
      x:pos.x, y:pos.y, w:120, h:36 });
    mmEdges.push({ from:"root", to:g.id });

    // Projects
    const gProjs = projects.filter(p => p.goalId === g.id);
    gProjs.forEach((proj, pi) => {
      const pa   = angle + (pi - Math.floor(gProjs.length/2)) * 0.35;
      const pr   = r * 0.6;
      const pdef = { x: pos.x + pr*Math.cos(pa) - 55, y: pos.y + pr*Math.sin(pa) - 16 };
      const ppos = posMap[proj.id] || pdef;
      mmNodes.push({ id:proj.id, type:"project", label:proj.name,
        x:ppos.x, y:ppos.y, w:110, h:32 });
      mmEdges.push({ from:g.id, to:proj.id });

      // Tasks under project
      tasks.filter(t => t.projId === proj.id).slice(0,4).forEach((t,ti) => {
        const ta   = pa + (ti-1)*0.3;
        const tr   = pr * 0.6;
        const tdef = { x: ppos.x + tr*Math.cos(ta) - 50, y: ppos.y + tr*Math.sin(ta) - 14 };
        const tpos = posMap[t.id] || tdef;
        mmNodes.push({ id:t.id, type:"task", label:t.title, done:t.done,
          x:tpos.x, y:tpos.y, w:105, h:28 });
        mmEdges.push({ from:proj.id, to:t.id });
      });
    });

    // Tasks directly under goal (no project)
    tasks.filter(t => t.goalId===g.id && !t.projId).slice(0,5).forEach((t,ti) => {
      const ta   = angle + (ti-2)*0.25;
      const tr   = r * 0.65;
      const tdef = { x: pos.x + tr*Math.cos(ta) - 50, y: pos.y + tr*Math.sin(ta) - 14 };
      const tpos = posMap[t.id] || tdef;
      mmNodes.push({ id:t.id, type:"task", label:t.title, done:t.done,
        x:tpos.x, y:tpos.y, w:105, h:28 });
      mmEdges.push({ from:g.id, to:t.id });
    });
  });

  // Tasks with no goal
  tasks.filter(t => !t.goalId && !t.projId).slice(0,6).forEach((t,ti) => {
    const angle = Math.PI/4 + ti*(Math.PI/8);
    const r2    = Math.min(cw,ch)*0.25;
    const def   = { x: cw/2 + r2*Math.cos(angle)-50, y: ch/2 + r2*Math.sin(angle)-14 };
    const tpos  = posMap[t.id] || def;
    mmNodes.push({ id:t.id, type:"task", label:t.title, done:t.done,
      x:tpos.x, y:tpos.y, w:105, h:28 });
    mmEdges.push({ from:"root", to:t.id });
  });

  drawMM();
  if (!eventsSet) { setupEvents(wrap); eventsSet = true; }
}

// ── Draw ──
function drawMM() {
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  wrap.querySelectorAll(".mm-node").forEach(n => n.remove());
  const svg = document.getElementById("mm-svg");

  let lines = "";
  mmEdges.forEach(e => {
    const fn = mmNodes.find(n => n.id===e.from), tn = mmNodes.find(n => n.id===e.to);
    if (!fn || !tn) return;
    const x1=(fn.x+fn.w/2)*mmScale+mmPan.x, y1=(fn.y+fn.h/2)*mmScale+mmPan.y;
    const x2=(tn.x+tn.w/2)*mmScale+mmPan.x, y2=(tn.y+tn.h/2)*mmScale+mmPan.y;
    const mx=(x1+x2)/2;
    const dash = tn.type==="task"  ? 'stroke-dasharray="4,3"' : "";
    const sw   = tn.type==="goal"  ? 2 : 1.5;
    const col  = tn.type==="task"  ? "rgba(123,79,30,.22)" : "rgba(123,79,30,.55)";
    lines += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"
      stroke="${col}" stroke-width="${sw}" fill="none" ${dash}/>`;
  });
  svg.innerHTML = lines;

  mmNodes.forEach(n => {
    const el = document.createElement("div");
    el.className = `mm-node type-${n.type}${n.id===mmSel?" sel":""}${n.done?" done":""}`;
    el.dataset.id = n.id;
    el.textContent = n.label;
    if (n.type==="goal" && n.color) el.style.background = n.color;
    el.style.left     = (n.x*mmScale + mmPan.x) + "px";
    el.style.top      = (n.y*mmScale + mmPan.y) + "px";
    el.style.width    = (n.w*mmScale) + "px";
    el.style.fontSize = ((n.type==="root"?13:n.type==="task"?10:11)*mmScale) + "px";
    wrap.appendChild(el);

    el.addEventListener("mousedown", e => { e.stopPropagation(); startDrag(e,n); });
    el.addEventListener("touchstart",e => { e.stopPropagation(); startDrag(e.touches[0],n); },{passive:true});
    el.addEventListener("click",     e => { e.stopPropagation(); selectNode(n,e); });
    el.addEventListener("dblclick",  e => { e.stopPropagation(); addChildOf(n); });
  });
}

function startDrag(e, node) {
  mmDrag    = node;
  mmDragOff = { x: e.clientX - node.x*mmScale - mmPan.x, y: e.clientY - node.y*mmScale - mmPan.y };
}

function selectNode(node, e) {
  closeCtx();
  mmSel = node.id === mmSel ? null : node.id;
  drawMM();
  if (mmSel) showCtx(e.clientX, e.clientY, node);
}

function addChildOf(parent) {
  if      (parent.type==="root")    window.openNewModal("goal",    null,      null,      "goals");
  else if (parent.type==="goal")    window.openNewModal("task",    parent.id, null,      "goals");
  else if (parent.type==="project") window.openNewModal("task",    null,      parent.id, "goals");
  else                              window.editTask(parent.id);
}

// ── Context menu ──
function showCtx(cx, cy, node) {
  closeCtx();
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "mm-ctx-menu"; menu.id = "mm-ctx";
  menu.style.left = (cx - rect.left) + "px";
  menu.style.top  = (cy - rect.top)  + "px";

  const items = !node ? [
    ["+ Задача",  () => window.openNewModal("task",   null,      null,      "goals")],
    ["+ Цель",    () => window.openNewModal("goal",   null,      null,      "goals")],
    ["+ Проект",  () => window.openNewModal("project",null,      null,      "goals")],
  ] : node.type==="root" ? [
    ["+ Добавить цель", () => window.openNewModal("goal",null,null,"goals")],
  ] : node.type==="goal" ? [
    ["+ Задача",        () => window.openNewModal("task",   node.id, null,     "goals")],
    ["+ Проект",        () => window.openNewModal("project",node.id, null,     "goals")],
    ["✎ Редактировать", () => window.openNewModal("goal",   null,    null,     "goals")],
    ["✕ Удалить цель",  async () => { if(confirm("Удалить цель?")) { await deleteGoal(node.id); window._refreshAll?.(); }}, true],
  ] : node.type==="project" ? [
    ["+ Задача",        () => window.openNewModal("task",null,node.id,"goals")],
    ["✕ Удалить проект",async () => { if(confirm("Удалить проект?")) { await deleteProject(node.id); window._refreshAll?.(); }}, true],
  ] : /* task */ [
    ["✎ Редактировать", () => window.editTask(node.id)],
    [`✓ ${node.done?"Открыть":"Выполнить"}`, async () => { await toggleTask(node.id); window._refreshAll?.(); }],
    ["✕ Удалить",       async () => { if(confirm("Удалить задачу?")) { await deleteTask(node.id); window._refreshAll?.(); }}, true],
  ];

  menu.innerHTML = items.map(([label,,danger]) =>
    `<button class="mm-ctx-item${danger?" danger":""}">${label}</button>`
  ).join("");
  menu.querySelectorAll(".mm-ctx-item").forEach((btn,i) => btn.onclick = () => { closeCtx(); items[i][1](); });
  wrap.appendChild(menu);
  mmCtxMenu = menu;
  setTimeout(() => document.addEventListener("click", outsideClose), 50);
}

function outsideClose(e) {
  if (mmCtxMenu && !mmCtxMenu.contains(e.target)) { closeCtx(); document.removeEventListener("click",outsideClose); }
}
function closeCtx() { mmCtxMenu?.remove(); mmCtxMenu = null; }

// ── Canvas events ──
function setupEvents(wrap) {
  // Canvas click → context menu
  wrap.addEventListener("click", e => {
    if (e.target===wrap || e.target===document.getElementById("mm-svg")) {
      closeCtx(); mmSel=null; drawMM();
      showCtx(e.clientX, e.clientY, null);
    }
  });
  // Canvas mousedown → pan
  wrap.addEventListener("mousedown", e => {
    if (e.target===wrap || e.target===document.getElementById("mm-svg")) {
      mmPanning=true; mmPanStart={x:e.clientX-mmPan.x, y:e.clientY-mmPan.y};
      wrap.style.cursor="grabbing";
    }
  });
  // Scroll → zoom
  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const delta    = e.deltaY < 0 ? 0.1 : -0.1;
    const newScale = Math.max(0.3, Math.min(2.5, mmScale+delta));
    const rect     = wrap.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    mmPan.x = mx - (mx-mmPan.x)*(newScale/mmScale);
    mmPan.y = my - (my-mmPan.y)*(newScale/mmScale);
    mmScale = newScale; drawMM();
  }, { passive:false });
  // Pinch zoom (mobile)
  let lastPinch = 0;
  wrap.addEventListener("touchstart", e => {
    if (e.touches.length===2)
      lastPinch = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
  }, { passive:true });
  wrap.addEventListener("touchmove", e => {
    if (e.touches.length===2 && lastPinch>0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      mmScale = Math.max(0.3, Math.min(2.5, mmScale*(d/lastPinch)));
      lastPinch=d; drawMM();
    }
  }, { passive:false });
}

// Global mouse/touch handlers
window.addEventListener("mousemove", e => {
  if (mmDrag) {
    mmDrag.x = (e.clientX-mmDragOff.x-mmPan.x)/mmScale;
    mmDrag.y = (e.clientY-mmDragOff.y-mmPan.y)/mmScale;
    drawMM();
  } else if (mmPanning) {
    mmPan = { x:e.clientX-mmPanStart.x, y:e.clientY-mmPanStart.y }; drawMM();
  }
});
window.addEventListener("mouseup", async () => {
  if (mmDrag) { await saveMmPos(mmDrag.id, mmDrag.x, mmDrag.y); mmDrag=null; }
  if (mmPanning) { mmPanning=false; const w=document.getElementById("mm-wrap"); if(w)w.style.cursor=""; }
});
window.addEventListener("touchmove", e => {
  if (mmDrag && e.touches.length===1) {
    const t=e.touches[0];
    mmDrag.x=(t.clientX-mmDragOff.x-mmPan.x)/mmScale;
    mmDrag.y=(t.clientY-mmDragOff.y-mmPan.y)/mmScale;
    drawMM(); e.preventDefault();
  }
}, { passive:false });
window.addEventListener("touchend", async () => {
  if (mmDrag) { await saveMmPos(mmDrag.id, mmDrag.x, mmDrag.y); mmDrag=null; }
});

// Toolbar buttons
document.getElementById("mm-reset")?.addEventListener("click", () => { mmPan={x:0,y:0}; mmScale=1; drawMM(); });
document.getElementById("mm-zoom-in")?.addEventListener("click",  () => { mmScale=Math.min(2.5,mmScale+0.2); drawMM(); });
document.getElementById("mm-zoom-out")?.addEventListener("click", () => { mmScale=Math.max(0.3,mmScale-0.2); drawMM(); });

// Expose for sidebar goal click
window._selectGoal = id => {
  mmSel = id; drawMM();
  const node = mmNodes.find(n => n.id===id);
  if (node) { mmPan.x = -node.x*mmScale + 200; mmPan.y = -node.y*mmScale + 150; drawMM(); }
};
window.closeMMCtx = closeCtx;
