// goals.js — v3
import { registerTab } from "../router.js";
import { getGoals, getProjects, getTasks, saveMmPos, getMmPos,
         deleteGoal, deleteProject, deleteTask, toggleTask,
         esc, today, getUid } from "../db.js";
import { toast } from "../modal.js";
import { GCOLS } from "../utils.js";

// ══ СОСТОЯНИЕ ══
let mmTree = null, mmFlat = [];
let mmPan = { x:0, y:0 }, mmScale = 1;
let mmSel = null;
let eventsSet = false;
let radialMenu = null;   // текущее радиальное меню в DOM

// ══ DRAG ══
let drag = null; // { node, sx, sy, moved }
let reparent = { active:false, nodeId:null, ghost:null, dropId:null };

// ══ ФОРМАТИРОВАНИЕ ══
const nodeColors = new Map();
let fmtLineStyle = "curve";
let fmtLineWidth = "medium";
let fmtNodeShape = "rect";
let fmtShowDone  = true;
let fmtLayout    = "right";

// ══ РАЗМЕРЫ НОД ══
const NW = { root:140, goal:160, project:140, task:130 };
const NH = { root:44,  goal:36,  project:30,  task:26  };
const VGAP = 12, HGAP = 56;

const DROP_TYPE = { root:"goal", goal:"project", project:"task", task:"task" };

export function initGoals() { registerTab("goals", renderGoals); }

// ══════════════════════════════════════════
//  SIDEBAR — панель форматирования
// ══════════════════════════════════════════
function renderSidebar(selNode) {
  const sb = document.getElementById("sb-body");
  if (!sb) return;
  const COLORS = ["#C06070","#A07840","#9060A0","#507860","#6060A0","#704040",
                  "#407060","#C8963E","#4A8A4A","#3A6EA8","#C04030","#7B4F1E",
                  "#5A3510","#A06A2E","#9A6F28","#EAE0C4"];

  sb.innerHTML = `
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">✦</span> Добавить</div>
      <div class="fmt-add-btns">
        <button class="fmt-add-btn" onclick="window.openNewModal('goal',null,null,'goals')">+ Цель</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('task',null,null,'goals')">+ Задача</button>
        <button class="fmt-add-btn" onclick="window.openNewModal('project',null,null,'goals')">+ Проект</button>
      </div>
    </div>
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">◉</span> Заливка
        ${!selNode||selNode.type==="root"?'<span style="font-size:9px;color:var(--tx-l);font-style:italic;font-weight:400;text-transform:none;letter-spacing:0"> (выберите элемент)</span>':""}
      </div>
      <div class="fmt-color-grid">
        <div class="fmt-color-cell auto ${selNode&&!nodeColors.get(selNode.id)?"sel":""}"
          onclick="window._fmtSetColor('')"><span>авто</span></div>
        ${COLORS.map(c=>`<div class="fmt-color-cell ${selNode&&nodeColors.get(selNode.id)===c?"sel":""}"
          style="background:${c}" onclick="window._fmtSetColor('${c}')"></div>`).join("")}
      </div>
    </div>
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">▣</span> Форма</div>
      <div class="fmt-btn-row">
        <button class="fmt-shape-btn ${fmtNodeShape==="rect"?"on":""}" onclick="window._fmtShape('rect')">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape==="rounded"?"on":""}" onclick="window._fmtShape('rounded')">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="fmt-shape-btn ${fmtNodeShape==="pill"?"on":""}" onclick="window._fmtShape('pill')">
          <svg width="36" height="20"><rect x="2" y="4" width="32" height="12" rx="9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </div>
    <div class="fmt-section">
      <div class="fmt-sec-title"><span class="fmt-sec-icon">⌇</span> Ветки</div>
      <div class="fmt-label">Стиль</div>
      <div class="fmt-btn-row">
        <button class="fmt-line-btn ${fmtLineStyle==="curve"?"on":""}" onclick="window._fmtLine('curve')">
          <svg width="46" height="22"><path d="M4,14 C16,14 30,6 42,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle==="straight"?"on":""}" onclick="window._fmtLine('straight')">
          <svg width="46" height="22"><line x1="4" y1="11" x2="42" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="fmt-line-btn ${fmtLineStyle==="elbow"?"on":""}" onclick="window._fmtLine('elbow')">
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

// ══════════════════════════════════════════
//  РАДИАЛЬНОЕ МЕНЮ
// ══════════════════════════════════════════
function closeRadialMenu() {
  if (radialMenu) { radialMenu.remove(); radialMenu = null; }
}

function openRadialMenu(node) {
  closeRadialMenu();
  const wrap = document.getElementById("mm-wrap");
  if (!wrap || node.type === "root") return;

  // Центр ноды в координатах wrap
  const cx = node.x * mmScale + mmPan.x + (node.w * mmScale) / 2;
  const cy = node.y * mmScale + mmPan.y + (node.h * mmScale) / 2;

  // Описываем кнопки
  const btns = [];
  if (node.type === "goal") {
    btns.push({ ico:"📁", lbl:"Проект", fn: () => { closeRadialMenu(); window.openNewModal("project",node.id,null,"goals"); } });
    btns.push({ ico:"✅", lbl:"Задача",  fn: () => { closeRadialMenu(); window.openNewModal("task",node.id,null,"goals"); } });
  } else if (node.type === "project") {
    btns.push({ ico:"✅", lbl:"Задача",  fn: () => { closeRadialMenu(); window.openNewModal("task",null,node.id,"goals"); } });
  }
  if (node.type === "task") {
    btns.push({ ico:"✎",  lbl:"Изменить", fn: () => { closeRadialMenu(); window.editTask(node.id); } });
    btns.push({ ico: node.done?"↩":"✓", lbl: node.done?"Открыть":"Готово",
      fn: async () => { closeRadialMenu(); await toggleTask(node.id); window._refreshAll?.(); } });
  }
  btns.push({ ico:"🔀", lbl:"Тип", fn: () => openTypeMenu(node, cx, cy) });
  btns.push({ ico:"✕",  lbl:"Удалить", danger:true,
    fn: async () => {
      closeRadialMenu();
      if (!confirm("Удалить элемент и всё вложенное?")) return;
      await delSubtree(node); mmSel=null; window._refreshAll?.();
    }
  });

  const menu = buildRadialDom(btns, cx, cy, wrap);
  wrap.appendChild(menu);
  radialMenu = menu;
  setTimeout(() => {
    function oc(e) {
      if (!radialMenu) { document.removeEventListener("click",oc); return; }
      if (!radialMenu.contains(e.target)) { closeRadialMenu(); document.removeEventListener("click",oc); }
    }
    document.addEventListener("click", oc);
  }, 0);
}

function openTypeMenu(node, cx, cy) {
  closeRadialMenu();
  const wrap = document.getElementById("mm-wrap"); if (!wrap) return;
  const types = [
    { ico:"🎯", lbl:"→ Цель",    t:"goal" },
    { ico:"📁", lbl:"→ Проект",  t:"project" },
    { ico:"✅", lbl:"→ Задача",  t:"task" },
  ].filter(x => x.t !== node.type);
  types.push({ ico:"←", lbl:"Назад", fn: () => openRadialMenu(node) });

  const btns = types.map(x => ({
    ico: x.ico, lbl: x.lbl,
    fn: x.fn || (async () => {
      closeRadialMenu();
      await changeType(node, x.t);
    })
  }));

  const menu = buildRadialDom(btns, cx, cy, wrap);
  wrap.appendChild(menu);
  radialMenu = menu;
  setTimeout(() => {
    function oc2(e) {
      if (!radialMenu) { document.removeEventListener("click",oc2); return; }
      if (!radialMenu.contains(e.target)) { closeRadialMenu(); document.removeEventListener("click",oc2); }
    }
    document.addEventListener("click", oc2);
  }, 0);
}

function buildRadialDom(btns, cx, cy, wrap) {
  const R = 58; // радиус
  const N = btns.length;
  const startAngle = -Math.PI / 2; // начинаем сверху

  const menu = document.createElement("div");
  // Позиционируем контейнер в точке центра ноды
  menu.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:0;height:0;z-index:500;pointer-events:none;`;

  btns.forEach((btn, i) => {
    const angle = startAngle + (2 * Math.PI * i) / N;
    const bx = Math.round(R * Math.cos(angle)); // смещение от центра
    const by = Math.round(R * Math.sin(angle));

    const b = document.createElement("button");
    b.style.cssText = [
      "position:absolute",
      `left:${bx - 24}px`,  // -24 = половина ширины кнопки (48px)
      `top:${by - 24}px`,
      "width:48px",
      "height:48px",
      "border-radius:50%",
      `background:${btn.danger ? "#C04030" : "var(--bg-p)"}`,
      `border:2px solid ${btn.danger ? "#C04030" : "var(--bd-s)"}`,
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:1px",
      "cursor:pointer",
      "pointer-events:all",
      "box-shadow:0 3px 14px rgba(80,40,10,.25)",
      `animation:radial-pop .18s ease ${i*25}ms both`,
      "z-index:500",
    ].join(";");

    const ico = document.createElement("span");
    ico.textContent = btn.ico;
    ico.style.cssText = "font-size:16px;line-height:1;pointer-events:none;";
    if (btn.danger) ico.style.color = "#fff";

    const lbl = document.createElement("span");
    lbl.textContent = btn.lbl;
    lbl.style.cssText = [
      "font-family:var(--fd)",
      "font-size:7px",
      "font-weight:700",
      "text-transform:uppercase",
      "letter-spacing:.02em",
      "pointer-events:none",
      btn.danger ? "color:#fff" : "color:var(--tx-l)",
      "white-space:nowrap",
    ].join(";");

    b.appendChild(ico);
    b.appendChild(lbl);

    b.addEventListener("mouseenter", () => {
      if (!btn.danger) { b.style.background="var(--go)"; b.style.borderColor="var(--go-d)"; ico.style.color="#fff"; lbl.style.color="#fff"; }
      b.style.transform = "scale(1.18)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = btn.danger ? "#C04030" : "var(--bg-p)";
      b.style.borderColor = btn.danger ? "#C04030" : "var(--bd-s)";
      ico.style.color = btn.danger ? "#fff" : "";
      lbl.style.color = btn.danger ? "#fff" : "var(--tx-l)";
      b.style.transform = "";
    });
    b.addEventListener("click", e => { e.stopPropagation(); btn.fn(); });

    menu.appendChild(b);
  });

  return menu;
}

// ══════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ
// ══════════════════════════════════════════
function findParent(nodeId) {
  for (const n of mmFlat) if (n.children.some(c=>c.id===nodeId)) return n;
  return null;
}

async function delSubtree(node) {
  for (const c of node.children) await delSubtree(c);
  if (node.type==="goal")    await deleteGoal(node.id);
  else if (node.type==="project") await deleteProject(node.id);
  else if (node.type==="task")    await deleteTask(node.id);
}

async function changeType(node, newType) {
  const parent = findParent(node.id);
  let targetNode;
  if (newType==="goal")    targetNode = mmFlat.find(n=>n.type==="root");
  else if (newType==="project") targetNode = mmFlat.find(n=>n.type==="goal") || mmFlat.find(n=>n.type==="root");
  else                     targetNode = parent?.type==="project" ? parent : (mmFlat.find(n=>n.type==="project") || mmFlat.find(n=>n.type==="goal") || mmFlat.find(n=>n.type==="root"));
  if (targetNode) await doReparent(node, targetNode.id);
}

async function doReparent(node, newParentId) {
  if (node.type==="root") return;
  const newParent = mmFlat.find(n=>n.id===newParentId); if (!newParent) return;
  const newType = DROP_TYPE[newParent.type] || "task";
  const { doc, updateDoc, addDoc, deleteDoc, collection } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { db } = await import("../firebase.js");
  const uid = getUid();
  const col = name => collection(db,"users",uid,name);
  const ud  = (name,id) => doc(db,"users",uid,name,id);
  try {
    if (node.type==="project" && newType==="project") {
      await updateDoc(ud("projects",node.id),{ goalId: newParent.type==="goal"?newParent.id:null });
    } else if (node.type==="task" && newType==="task") {
      await updateDoc(ud("tasks",node.id),{
        goalId: newParent.type==="goal"?newParent.id:null,
        projId: newParent.type==="project"?newParent.id:null,
      });
    } else if (newType==="goal") {
      await addDoc(col("goals"),{title:node.label,desc:"",createdAt:new Date()});
      if (node.type==="project") await deleteDoc(ud("projects",node.id));
      else if (node.type==="task") await deleteDoc(ud("tasks",node.id));
    } else if (newType==="project") {
      await addDoc(col("projects"),{name:node.label,goalId:newParent.type==="goal"?newParent.id:null,desc:"",createdAt:new Date()});
      if (node.type==="goal") await deleteDoc(ud("goals",node.id));
      else if (node.type==="task") await deleteDoc(ud("tasks",node.id));
    } else { // task
      await addDoc(col("tasks"),{title:node.label,note:"",
        goalId:newParent.type==="goal"?newParent.id:null,
        projId:newParent.type==="project"?newParent.id:null,
        done:false,priority:"med",subtasks:[],date:today(),createdAt:new Date()});
      if (node.type==="goal") await deleteDoc(ud("goals",node.id));
      else if (node.type==="project") await deleteDoc(ud("projects",node.id));
    }
    toast("Перемещено ✓"); mmSel=null; window._refreshAll?.();
  } catch(e) { console.error(e); toast("Ошибка"); }
}

// ══════════════════════════════════════════
//  RENDER GOALS
// ══════════════════════════════════════════
export async function renderGoals() {
  document.getElementById("tb-ttl").textContent = "Цели";
  const [goals, projects, allTasks] = await Promise.all([getGoals(),getProjects(),getTasks()]);
  const tasks = fmtShowDone ? allTasks : allTasks.filter(t=>!t.done);
  renderSidebar(mmFlat.find(n=>n.id===mmSel)||null);

  const wrap = document.getElementById("mm-wrap");
  const cw = wrap.offsetWidth||800, ch = wrap.offsetHeight||500;

  const mk = (id,type,label,color,done) => ({
    id,type,label,color,done:!!done,
    w:NW[type]||130,h:NH[type]||28,
    children:[],x:0,y:0,subtreeH:0,subtreeW:0
  });

  const root = mk("root","root","МОИ ЦЕЛИ",null,false);
  goals.forEach((g,gi)=>{
    const dc=GCOLS[gi%GCOLS.length];
    const gn=mk(g.id,"goal",g.title,nodeColors.get(g.id)||dc,false);
    projects.filter(p=>p.goalId===g.id).forEach(p=>{
      const pn=mk(p.id,"project",p.name,nodeColors.get(p.id)||dc,false);
      tasks.filter(t=>t.projId===p.id).forEach(t=>pn.children.push(mk(t.id,"task",t.title,nodeColors.get(t.id)||dc,t.done)));
      gn.children.push(pn);
    });
    tasks.filter(t=>t.goalId===g.id&&!t.projId).forEach(t=>gn.children.push(mk(t.id,"task",t.title,nodeColors.get(t.id)||dc,t.done)));
    root.children.push(gn);
  });
  tasks.filter(t=>!t.goalId&&!t.projId).forEach(t=>root.children.push(mk(t.id,"task",t.title,GCOLS[0],t.done)));

  // Layout
  function sz(n){
    if(!n.children.length){n.subtreeH=n.h;n.subtreeW=n.w;return;}
    let tH=0,tW=0;
    n.children.forEach((c,i)=>{sz(c);const g=i<n.children.length-1?VGAP:0;
      if(fmtLayout==="right"){tH+=c.subtreeH+g;tW=Math.max(tW,c.subtreeW);}
      else{tW+=c.subtreeW+g;tH=Math.max(tH,c.subtreeH);}
    });
    n.subtreeH=fmtLayout==="right"?Math.max(n.h,tH):n.h+HGAP+tH;
    n.subtreeW=fmtLayout==="right"?n.w+HGAP+tW:Math.max(n.w,tW);
  }
  sz(root);
  function lay(n,x,cy){
    if(fmtLayout==="right"){n.x=x;n.y=cy-n.h/2;if(!n.children.length)return;
      const cx2=x+n.w+HGAP;let curY=cy-n.subtreeH/2;
      n.children.forEach(c=>{lay(c,cx2,curY+c.subtreeH/2);curY+=c.subtreeH+VGAP;});
    }else{n.x=cy-n.w/2;n.y=x;if(!n.children.length)return;
      const cy2=x+n.h+HGAP;let curX=cy-n.subtreeW/2;
      n.children.forEach(c=>{lay(c,cy2,curX+c.subtreeW/2);curX+=c.subtreeW+VGAP;});
    }
  }
  lay(root,40,fmtLayout==="right"?ch/2:cw/2);

  mmFlat=[]; (function fl(n){mmFlat.push(n);n.children.forEach(fl);})(root);
  mmTree=root;

  drawMM();
  if(!eventsSet){setupEvents(wrap);eventsSet=true;}
}

// ══════════════════════════════════════════
//  DRAW
// ══════════════════════════════════════════
function drawMM() {
  const wrap = document.getElementById("mm-wrap"); if(!wrap) return;
  // Удаляем только ноды, НЕ трогаем радиальное меню
  wrap.querySelectorAll(".mm-node").forEach(n=>n.remove());
  const svg = document.getElementById("mm-svg");
  if(!mmTree){svg.innerHTML="";return;}

  const lw={thin:1.2,medium:2,thick:3.5}[fmtLineWidth]||2;
  let lines="";
  function edges(n){
    n.children.forEach(c=>{
      let x1,y1,x2,y2;
      if(fmtLayout==="right"){
        x1=(n.x+n.w)*mmScale+mmPan.x;y1=(n.y+n.h/2)*mmScale+mmPan.y;
        x2=c.x*mmScale+mmPan.x;      y2=(c.y+c.h/2)*mmScale+mmPan.y;
      }else{
        x1=(n.x+n.w/2)*mmScale+mmPan.x;y1=(n.y+n.h)*mmScale+mmPan.y;
        x2=(c.x+c.w/2)*mmScale+mmPan.x;y2=c.y*mmScale+mmPan.y;
      }
      const raw=c.color&&c.color!=="var(--tx-l)"?c.color:"#7B4F1E";
      const col=c.type==="task"?raw+"55":raw+"bb";
      const sw=c.type==="goal"?lw*1.5:c.type==="project"?lw:lw*0.75;
      const dsh=c.type==="task"?'stroke-dasharray="5,3"':"";
      const isDrop=reparent.active&&c.id===reparent.dropId;
      const mx=(x1+x2)/2,my=(y1+y2)/2;
      let d;
      if(fmtLineStyle==="curve") d=fmtLayout==="right"?`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`:`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      else if(fmtLineStyle==="straight") d=`M${x1},${y1} L${x2},${y2}`;
      else d=fmtLayout==="right"?`M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`:`M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
      lines+=`<path d="${d}" stroke="${isDrop?"var(--go)":col}" stroke-width="${isDrop?lw*2:sw}" fill="none" ${dsh} stroke-linecap="round" stroke-linejoin="round"/>`;
      edges(c);
    });
  }
  edges(mmTree);
  svg.innerHTML=lines;

  const br={rect:"4px",rounded:"10px",pill:"999px"}[fmtNodeShape]||"4px";

  function nodes(n){
    const el=document.createElement("div");
    const isDrop=reparent.active&&n.id===reparent.dropId&&n.id!==reparent.nodeId;
    el.className=`mm-node type-${n.type}${n.id===mmSel?" sel":""}${n.done?" done":""}${isDrop?" drop-target":""}`;
    el.dataset.id=n.id;
    if(n.type!=="root"&&n.color) el.style.setProperty("--nc",n.color);
    if(n.type!=="root") el.style.borderRadius=br;

    // Inline edit
    if(n.id===mmSel&&window._mmInlineEdit){
      el.innerHTML=`<input class="mm-inline-input" id="mm-inline-inp" value="${esc(n.label)}"
        onkeydown="if(event.key==='Enter'){event.preventDefault();window._mmSaveInline();}if(event.key==='Escape'){window._mmCancelInline();}"
        onclick="event.stopPropagation()"/>`;
    }else{
      el.innerHTML=`<span class="mm-node-txt">${esc(n.label)}</span>`;
    }
    el.style.cssText+=`left:${n.x*mmScale+mmPan.x}px;top:${n.y*mmScale+mmPan.y}px;width:${n.w*mmScale}px;height:${n.h*mmScale}px;`;
    wrap.appendChild(el);

    // Drag
    const ds=(cx,cy)=>{drag={node:n,sx:cx,sy:cy,moved:false};reparent.nodeId=n.id;};
    el.addEventListener("mousedown",e=>{e.stopPropagation();ds(e.clientX,e.clientY);});
    el.addEventListener("touchstart",e=>{e.stopPropagation();ds(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});

    // Клик — открываем/закрываем радиальное меню
    el.addEventListener("click",e=>{
      e.stopPropagation();
      if(drag?.moved) return;
      window._mmCancelInline?.();
      if(mmSel===n.id){
        mmSel=null; closeRadialMenu(); drawMM(); renderSidebar(null); return;
      }
      mmSel=n.id;
      closeRadialMenu();
      drawMM();
      renderSidebar(mmFlat.find(x=>x.id===mmSel)||null);
      if(n.type!=="root") setTimeout(()=>openRadialMenu(n), 50);
    });

    // Двойной клик — inline rename
    el.addEventListener("dblclick",e=>{
      e.stopPropagation(); if(n.type==="root") return;
      closeRadialMenu(); mmSel=n.id; window._mmInlineEdit=true; drawMM();
      setTimeout(()=>{const i=document.getElementById("mm-inline-inp");if(i){i.focus();i.select();}},30);
    });

    n.children.forEach(nodes);
  }
  nodes(mmTree);

  // Inline-focus после рендера
  if(mmSel&&window._mmInlineEdit){
    setTimeout(()=>{const i=document.getElementById("mm-inline-inp");if(i){i.focus();i.select();}},30);
  }
}

// ══════════════════════════════════════════
//  СОБЫТИЯ
// ══════════════════════════════════════════
function setupEvents(wrap) {
  // Клик на canvas
  wrap.addEventListener("click",e=>{
    if(e.target===wrap||e.target===document.getElementById("mm-svg")){
      window._mmCancelInline?.();
      closeRadialMenu();
      mmSel=null; drawMM(); renderSidebar(null);
    }
  });

  // Pan
  let panning=false,panStart={x:0,y:0};
  wrap.addEventListener("mousedown",e=>{
    if(e.target===wrap||e.target===document.getElementById("mm-svg")){
      panning=true;panStart={x:e.clientX-mmPan.x,y:e.clientY-mmPan.y};
    }
  });

  window.addEventListener("mousemove",e=>{
    if(drag){
      const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
      if(!drag.moved&&(Math.abs(dx)>5||Math.abs(dy)>5)){
        drag.moved=true; reparent.active=true;
        const gh=document.createElement("div");
        gh.className="mm-drag-ghost"; gh.textContent=drag.node.label;
        document.body.appendChild(gh); reparent.ghost=gh;
        wrap.style.cursor="grabbing";
      }
      if(drag.moved&&reparent.ghost){
        reparent.ghost.style.left=e.clientX+10+"px";
        reparent.ghost.style.top=e.clientY-14+"px";
        const r=wrap.getBoundingClientRect();
        const mx=(e.clientX-r.left-mmPan.x)/mmScale,my=(e.clientY-r.top-mmPan.y)/mmScale;
        let hov=null;
        for(const n of mmFlat){if(n.id===drag.node.id)continue;if(mx>=n.x&&mx<=n.x+n.w&&my>=n.y&&my<=n.y+n.h){hov=n;break;}}
        const nd=hov?.id||null;
        if(nd!==reparent.dropId){reparent.dropId=nd;drawMM();}
        if(hov){const t=DROP_TYPE[hov.type]||"task";reparent.ghost.dataset.hint=`→ ${{goal:"Цель",project:"Проект",task:"Задача"}[t]}`;}
        else reparent.ghost.dataset.hint="";
      }
      return;
    }
    if(panning){mmPan={x:e.clientX-panStart.x,y:e.clientY-panStart.y};drawMM();}
  });

  window.addEventListener("mouseup",async()=>{
    const moved = drag?.moved;
    if(drag?.moved&&reparent.dropId) await doReparent(drag.node,reparent.dropId);
    else if(drag?.moved) await saveMmPos(drag.node.id,drag.node.x,drag.node.y);
    cleanDrag(moved);
    if(panning){panning=false;wrap.style.cursor="";}
  });

  window.addEventListener("touchend",async()=>{
    const moved = drag?.moved;
    if(drag?.moved&&reparent.dropId) await doReparent(drag.node,reparent.dropId);
    else if(drag?.moved) await saveMmPos(drag.node.id,drag.node.x,drag.node.y);
    cleanDrag(moved); panning=false;
  });

  wrap.addEventListener("wheel",e=>{
    e.preventDefault();
    const ns=Math.max(0.25,Math.min(3,mmScale+(e.deltaY<0?0.1:-0.1)));
    const r=wrap.getBoundingClientRect();
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    mmPan.x=mx-(mx-mmPan.x)*(ns/mmScale);
    mmPan.y=my-(my-mmPan.y)*(ns/mmScale);
    mmScale=ns; drawMM();
  },{passive:false});

  let lp=0;
  wrap.addEventListener("touchstart",e=>{if(e.touches.length===2)lp=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});
  wrap.addEventListener("touchmove",e=>{
    if(e.touches.length===2&&lp>0){e.preventDefault();
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      mmScale=Math.max(0.25,Math.min(3,mmScale*(d/lp)));lp=d;drawMM();}
  },{passive:false});

  window.addEventListener("keydown",e=>{if(e.key==="Escape"){cleanDrag(true);closeRadialMenu();window._mmCancelInline?.();}});
}

function cleanDrag(wasMoved){
  reparent.ghost?.remove();
  reparent={active:false,nodeId:null,ghost:null,dropId:null};
  drag=null;
  document.getElementById("mm-wrap")?.style.removeProperty("cursor");
  if(wasMoved) drawMM(); // перерисовываем только если нода реально двигалась
}

// ══════════════════════════════════════════
//  INLINE RENAME
// ══════════════════════════════════════════
window._mmInlineEdit = false;
window._mmSaveInline = async()=>{
  const inp=document.getElementById("mm-inline-inp"); if(!inp||!mmSel) return;
  const val=inp.value.trim(); if(!val){window._mmCancelInline();return;}
  const node=mmFlat.find(n=>n.id===mmSel); if(!node) return;
  window._mmInlineEdit=false;
  try{
    const {doc,updateDoc}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const {db}=await import("../firebase.js");
    const uid=getUid();
    const col=node.type==="goal"?"goals":node.type==="project"?"projects":"tasks";
    const field=node.type==="project"?"name":"title";
    await updateDoc(doc(db,"users",uid,col,node.id),{[field]:val});
    toast("Переименовано ✓"); window._refreshAll?.();
  }catch(e){console.error(e);window._mmCancelInline();}
};
window._mmCancelInline=()=>{if(!window._mmInlineEdit)return;window._mmInlineEdit=false;drawMM();};

// ══════════════════════════════════════════
//  TOOLBAR + FORMAT
// ══════════════════════════════════════════
document.getElementById("mm-reset")?.addEventListener("click",()=>{mmPan={x:0,y:0};mmScale=1;drawMM();});
document.getElementById("mm-zoom-in")?.addEventListener("click",()=>{mmScale=Math.min(3,mmScale+0.2);drawMM();});
document.getElementById("mm-zoom-out")?.addEventListener("click",()=>{mmScale=Math.max(0.25,mmScale-0.2);drawMM();});

window._fmtSetColor=c=>{if(!mmSel)return;if(c)nodeColors.set(mmSel,c);else nodeColors.delete(mmSel);const n=mmFlat.find(x=>x.id===mmSel);if(n)n.color=c||null;renderSidebar(n||null);drawMM();};
window._fmtShape=s=>{fmtNodeShape=s;renderSidebar(mmFlat.find(n=>n.id===mmSel)||null);drawMM();};
window._fmtLine=s=>{fmtLineStyle=s;renderSidebar(mmFlat.find(n=>n.id===mmSel)||null);drawMM();};
window._fmtWidth=w=>{fmtLineWidth=w;renderSidebar(mmFlat.find(n=>n.id===mmSel)||null);drawMM();};
window._fmtLayout=l=>{fmtLayout=l;window._refreshAll?.();};
window._fmtShowDone=()=>{fmtShowDone=!fmtShowDone;window._refreshAll?.();};
window._mmToggle=async id=>{await toggleTask(id);window._refreshAll?.();};
window._mmDelete=async(id,type)=>{if(!confirm("Удалить?"))return;if(type==="goal")await deleteGoal(id);else if(type==="project")await deleteProject(id);else await deleteTask(id);mmSel=null;window._refreshAll?.();};
window._selectGoal=id=>{
  mmSel=id; const node=mmFlat.find(n=>n.id===id);
  if(node){const w=document.getElementById("mm-wrap");const cw=w?.offsetWidth||800,ch=w?.offsetHeight||500;mmPan.x=cw/2-(node.x+node.w/2)*mmScale;mmPan.y=ch/2-(node.y+node.h/2)*mmScale;}
  drawMM(); renderSidebar(node||null);
};
window.closeMMCtx=()=>{};
