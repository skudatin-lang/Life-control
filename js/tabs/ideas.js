// ════════════════════════════════════════
//  TAB: ИДЕИ
//  js/tabs/ideas.js
// ════════════════════════════════════════

import { registerTab, buildDayNav } from "../router.js";
import { getIdeas, dstr, esc, isOv, fdt } from "../db.js";

let ideasDate = new Date(); ideasDate.setHours(0,0,0,0);
let showAll   = false;
let ideasMode = "day"; // day | all

export function initIdeas() { registerTab("ideas", renderIdeas); }

// ════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════
function renderIdeasSidebar(all) {
  const td      = dstr(new Date());
  const dayCnt  = all.filter(x => x.date === td).length;

  document.getElementById("sb-body").innerHTML = `
    <div class="sb-tiles-grid">
      <button class="sb-tile ${ideasMode==="day"?"on":""}" onclick="window._ideasMode('day')">
        <div class="sb-tile-ico">💡</div>
        <div class="sb-tile-lbl">Идеи дня</div>
        <div class="sb-tile-cnt">${dayCnt}</div>
      </button>
      <button class="sb-tile ${ideasMode==="all"?"on":""}" onclick="window._ideasMode('all')">
        <div class="sb-tile-ico">🗂</div>
        <div class="sb-tile-lbl">Все идеи</div>
        <div class="sb-tile-cnt">${all.length}</div>
      </button>
    </div>`;
}

// ════════════════════════════════════════
//  ПРАВАЯ ЧАСТЬ
// ════════════════════════════════════════
function renderIdeasMain(all) {
  const body = document.getElementById("ideas-body");

  if (ideasMode === "day") {
    // ── Идеи с dayNav ──
    const datesWT = new Set(all.map(x => x.date).filter(Boolean));
    body.innerHTML = `<div id="ideas-dn"></div><div id="ideas-list"></div>`;

    buildDayNav(ideasDate, datesWT, showAll, "ideas-dn",
      d => { ideasDate = d; showAll = false; renderIdeas(); },
      () => { showAll = !showAll; renderIdeas(); }
    );

    const items = (showAll ? all : all.filter(x => x.date === dstr(ideasDate)))
      .sort((a,b) => (b.createdAt?.toDate?.() ?? 0) - (a.createdAt?.toDate?.() ?? 0));

    document.getElementById("ideas-list").innerHTML = items.length
      ? items.map(x => ideaCard(x)).join("")
      : '<div class="empty"><div class="ei">💡</div><p>Нет идей — нажмите «+»</p></div>';

  } else {
    // ── Все идеи ──
    const sorted = [...all].sort((a,b) => (b.createdAt?.toDate?.() ?? 0) - (a.createdAt?.toDate?.() ?? 0));
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Все идеи (${sorted.length})</div>
      ${sorted.length
        ? sorted.map(x => ideaCard(x)).join("")
        : '<div class="empty"><div class="ei">💡</div><p>Идей нет — нажмите «+»</p></div>'}`;
  }

  body.insertAdjacentHTML("beforeend",
    `<button class="fab" onclick="window.openNewModal('idea',null,null,'ideas')">+</button>`);
}

// ── Карточка идеи ──
function ideaCard(x) {
  return `
    <div class="icard" onclick="window.editIdea('${x.id}')">
      <div class="ic-body">
        <div class="ic-ttl">${esc(x.title || "Без заголовка")}</div>
        ${x.text ? `<div style="font-size:12px;color:var(--tx-m);margin-top:4px">${esc(x.text.slice(0,120))}${x.text.length>120?"…":""}</div>` : ""}
        <div class="ic-meta">
          <span class="ic-tag tag-dl">${x.date || ""}</span>
          ${x.deadline ? `<span class="ic-tag tag-dl ${isOv(x.deadline)?"ov":""}">${fdt(x.deadline)}</span>` : ""}
        </div>
      </div>
      <div class="ic-acts">
        <button class="ib" onclick="event.stopPropagation();window.editIdea('${x.id}')" title="Редактировать">✎</button>
        <button class="ib del" onclick="event.stopPropagation();window.delItem('ideas','${x.id}')">🗑</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════
export async function renderIdeas() {
  document.getElementById("tb-ttl").textContent = "Идеи";
  const all = await getIdeas();
  renderIdeasSidebar(all);
  renderIdeasMain(all);
}

// ── Глобальный хэндлер ──
window._ideasMode = async mode => {
  ideasMode = mode;
  const all = await getIdeas();
  renderIdeasSidebar(all);
  renderIdeasMain(all);
};
