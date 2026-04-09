// ════════════════════════════════════════
//  TAB: ДНЕВНИК
//  js/tabs/diary.js
// ════════════════════════════════════════

import { registerTab, buildDayNav } from "../router.js";
import { getDiary, getTemplates, deleteTemplate, dstr, esc } from "../db.js";
import { buildDiaryModal } from "../forms.js";

let diaryDate = new Date(); diaryDate.setHours(0,0,0,0);
let showAll   = false;

export function initDiary() {
  registerTab("diary", renderDiary);
}

export async function renderDiary() {
  document.getElementById("tb-ttl").textContent = "Дневник";

  const [entries, templates] = await Promise.all([getDiary(), getTemplates()]);
  const datesWT = new Set(entries.map(x => x.date).filter(Boolean));

  // ── Sidebar: templates ──
  const sb = document.getElementById("sb-body");
  sb.innerHTML = `
    <div class="sb-sec">Шаблоны</div>
    ${templates.length ? templates.map(t => `
      <div class="tmpl-pill" onclick="window._useTmpl('${t.id}')">
        <span>${esc(t.title)}</span>
        <button class="ib del"
          onclick="event.stopPropagation();window.delItem('templates','${t.id}')">🗑</button>
      </div>`).join("")
      : '<p style="font-size:11px;color:var(--tx-l)">Шаблонов нет</p>'}
    <button class="sb-new" style="margin-top:10px"
      onclick="window.openNewModal('template',null,null,'diary')">+ Новый шаблон</button>`;

  // ── Body ──
  const body = document.getElementById("diary-body");
  body.innerHTML = `<div id="diary-dn"></div><div id="diary-list"></div>`;

  buildDayNav(diaryDate, datesWT, showAll, "diary-dn",
    d => { diaryDate=d; showAll=false; renderDiary(); },
    () => { showAll=!showAll; renderDiary(); }
  );

  const items = (showAll ? entries : entries.filter(x => x.date===dstr(diaryDate)))
    .sort((a,b) => (b.createdAt?.toDate?.()??0) - (a.createdAt?.toDate?.()??0));

  document.getElementById("diary-list").innerHTML = items.length
    ? items.map(x => `
        <div class="icard" onclick="window.editDiary('${x.id}')">
          <div class="ic-body">
            <div class="ic-ttl">${esc(x.title||"Без заголовка")}</div>
            ${x.text ? `<div style="font-size:12px;color:var(--tx-m);margin-top:4px">${esc(x.text.slice(0,130))}${x.text.length>130?"…":""}</div>` : ""}
            <div class="ic-meta"><span class="ic-tag tag-dl">${x.date||""} ${x.time||""}</span></div>
          </div>
          <div class="ic-acts">
            <button class="ib del" onclick="event.stopPropagation();window.delItem('diary','${x.id}')">🗑</button>
          </div>
        </div>`).join("")
    : '<div class="empty"><div class="ei">📖</div><p>Записей нет — нажмите «+»</p></div>';

  body.insertAdjacentHTML("beforeend",
    `<button class="fab" onclick="window.openNewModal('diary',null,null,'diary')">+</button>`);

  // Use template
  window._useTmpl = async id => {
    const all = await getTemplates();
    const t   = all.find(x => x.id===id); if (!t) return;
    buildDiaryModal("Новая запись в дневник", t);
  };
}
