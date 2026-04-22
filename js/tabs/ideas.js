// ════════════════════════════════════════
//  TAB: ИДЕИ
//  js/tabs/ideas.js
// ════════════════════════════════════════

import { registerTab, buildDayNav } from "../router.js";
import { getIdeas, deleteIdea, dstr, esc, isOv, fdt, toTS } from "../db.js";

let ideasDate = new Date(); ideasDate.setHours(0,0,0,0);
let showAll   = false;

export function initIdeas() {
  registerTab("ideas", renderIdeas);
}

export async function renderIdeas() {
  document.getElementById("tb-ttl").textContent = "Идеи";
  document.getElementById("sb-body").innerHTML  = "";

  const all     = await getIdeas();
  const datesWT = new Set(all.map(x => x.date).filter(Boolean));
  const body    = document.getElementById("ideas-body");
  body.innerHTML = `<div id="ideas-dn"></div><div id="ideas-list"></div>`;

  buildDayNav(ideasDate, datesWT, showAll, "ideas-dn",
    d => { ideasDate=d; showAll=false; renderIdeas(); },
    () => { showAll=!showAll; renderIdeas(); }
  );

  const items = (showAll ? all : all.filter(x => x.date===dstr(ideasDate)))
    .sort((a,b) => (b.createdAt?.toDate?.()??0) - (a.createdAt?.toDate?.()??0));

  document.getElementById("ideas-list").innerHTML = items.length
    ? items.map(x => `
        <div class="icard" onclick="window.editIdea('${x.id}')">
          <div class="ic-body">
            <div class="ic-ttl">${esc(x.title||"Без заголовка")}</div>
            ${x.text ? `<div style="font-size:12px;color:var(--tx-m);margin-top:4px">${esc(x.text)}</div>` : ""}
            ${x.deadline ? `<div class="ic-meta"><span class="ic-tag tag-dl ${isOv(x.deadline)?"ov":""}">${fdt(x.deadline)}</span></div>` : ""}
          </div>
          <div class="ic-acts">
            <button class="ib del" onclick="event.stopPropagation();window.delItem('ideas','${x.id}')">🗑</button>
          </div>
        </div>`).join("")
    : '<div class="empty"><div class="ei">💡</div><p>Нет идей — нажмите «+»</p></div>';

  body.insertAdjacentHTML("beforeend",
    `<button class="fab" onclick="window.openNewModal('idea',null,null,'ideas')">+</button>`);
}
