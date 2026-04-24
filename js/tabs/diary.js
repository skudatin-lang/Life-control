// ════════════════════════════════════════
//  TAB: ДНЕВНИК
//  js/tabs/diary.js
// ════════════════════════════════════════

import { registerTab, buildDayNav } from "../router.js";
import { getDiary, getTemplates, deleteTemplate, dstr, esc } from "../db.js";
import { buildDiaryModal, buildTemplateModal } from "../forms.js";

let diaryDate = new Date(); diaryDate.setHours(0,0,0,0);
let showAll   = false;
let diaryMode = "day";   // day | templates | all | search
let searchTag = "";       // текущий тег для поиска

export function initDiary() { registerTab("diary", renderDiary); }

// ════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════
function renderDiarySidebar(entries, templates) {
  document.getElementById("sb-body").innerHTML = `
    <div class="sb-tiles-grid">
      <button class="sb-tile ${diaryMode==="templates"?"on":""}" onclick="window._diaryMode('templates')">
        <div class="sb-tile-ico">📄</div>
        <div class="sb-tile-lbl">Шаблоны</div>
        <div class="sb-tile-cnt">${templates.length}</div>
      </button>
      <button class="sb-tile sb-tile-accent" onclick="window.openNewModal('template',null,null,'diary')">
        <div class="sb-tile-ico">✦</div>
        <div class="sb-tile-lbl">Новый шаблон</div>
        <div class="sb-tile-cnt"></div>
      </button>
      <button class="sb-tile ${diaryMode==="all"?"on":""}" onclick="window._diaryMode('all')">
        <div class="sb-tile-ico">📚</div>
        <div class="sb-tile-lbl">Все записи</div>
        <div class="sb-tile-cnt">${entries.length}</div>
      </button>
      <button class="sb-tile ${diaryMode==="search"?"on":""}" onclick="window._diaryMode('search')">
        <div class="sb-tile-ico">🔍</div>
        <div class="sb-tile-lbl">Найти запись</div>
        <div class="sb-tile-cnt"></div>
      </button>
    </div>`;
}

// ════════════════════════════════════════
//  ПРАВАЯ ЧАСТЬ
// ════════════════════════════════════════
function renderDiaryMain(entries, templates) {
  const body = document.getElementById("diary-body");

  if (diaryMode === "day") {
    // ── Обычный дневник с dayNav ──
    const datesWT = new Set(entries.map(x => x.date).filter(Boolean));
    body.innerHTML = `<div id="diary-dn"></div><div id="diary-list"></div>`;

    buildDayNav(diaryDate, datesWT, showAll, "diary-dn",
      d => { diaryDate = d; showAll = false; renderDiary(); },
      () => { showAll = !showAll; renderDiary(); }
    );

    const items = (showAll ? entries : entries.filter(x => x.date === dstr(diaryDate)))
      .sort((a,b) => (b.createdAt?.toDate?.() ?? 0) - (a.createdAt?.toDate?.() ?? 0));

    document.getElementById("diary-list").innerHTML = items.length
      ? items.map(x => diaryCard(x)).join("")
      : '<div class="empty"><div class="ei">📖</div><p>Записей нет — нажмите «+»</p></div>';

  } else if (diaryMode === "templates") {
    // ── Шаблоны ──
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Шаблоны (${templates.length})</div>
      ${templates.length ? templates.map(t => `
        <div class="icard">
          <div class="ic-body" onclick="window._useTmpl('${t.id}')" style="cursor:pointer">
            <div class="ic-ttl">${esc(t.title)}</div>
            ${t.body ? `<div style="font-size:12px;color:var(--tx-m);margin-top:3px">${esc(t.body.slice(0,100))}${t.body.length>100?"…":""}</div>` : ""}
            <div class="ic-meta"><span class="ic-tag tag-goal">Нажмите чтобы использовать</span></div>
          </div>
          <div class="ic-acts">
            <button class="ib del" onclick="event.stopPropagation();window.delItem('templates','${t.id}')">🗑</button>
          </div>
        </div>`).join("")
      : '<div class="empty"><div class="ei">📄</div><p>Шаблонов нет</p></div>'}`;

  } else if (diaryMode === "all") {
    // ── Все записи ──
    const sorted = [...entries].sort((a,b) => (b.date||"") > (a.date||"") ? 1 : -1);
    body.innerHTML = `
      <div class="sec-lbl" style="margin-bottom:10px">Все записи (${sorted.length})</div>
      ${sorted.length
        ? sorted.map(x => diaryCard(x)).join("")
        : '<div class="empty"><div class="ei">📚</div><p>Записей нет</p></div>'}`;

  } else if (diaryMode === "search") {
    // ── Собираем все уникальные теги из записей ──
    const allTags = [...new Set(
      entries.flatMap(x => Array.isArray(x.tags) ? x.tags : [])
    )].sort();

    const matches = searchTag.trim()
      ? entries.filter(x =>
          (x.title  || "").toLowerCase().includes(searchTag.toLowerCase()) ||
          (x.text   || "").toLowerCase().includes(searchTag.toLowerCase()) ||
          (x.mood   || "").toLowerCase().includes(searchTag.toLowerCase()) ||
          (Array.isArray(x.tags) && x.tags.some(t => t.toLowerCase().includes(searchTag.toLowerCase()))))
        .sort((a,b) => (b.date||"") > (a.date||"") ? 1 : -1)
      : [];

    body.innerHTML = `
      <div class="diary-search-wrap">
        <input class="inp" id="diary-search-inp"
          placeholder="Введите слово, фразу или тег..."
          value="${esc(searchTag)}"/>
        <button class="dn-cal-btn" id="diary-search-btn">🔍</button>
      </div>
      ${allTags.length ? `
        <div class="diary-tags-cloud">
          <div class="diary-tags-cloud-lbl">Теги</div>
          <div class="diary-tags-cloud-wrap">
            ${allTags.map(t => `
              <button class="diary-cloud-tag ${searchTag===t?"active":""}"
                onclick="window._diarySearchTag('${esc(t)}')">#${esc(t)}</button>`).join("")}
          </div>
        </div>` : ""}
      <div id="diary-search-results">
        ${searchTag.trim()
          ? (matches.length
              ? `<div class="sec-lbl" style="margin:10px 0 8px">Найдено: ${matches.length}</div>
                 ${matches.map(x => diaryCard(x)).join("")}`
              : '<div class="empty"><div class="ei">🔍</div><p>Ничего не найдено</p></div>')
          : '<div class="empty"><div class="ei">🔍</div><p>Введите запрос или выберите тег</p></div>'}
      </div>`;

    const inp = document.getElementById("diary-search-inp");
    const btn = document.getElementById("diary-search-btn");
    const doSearch = () => { searchTag = inp.value; renderDiaryMain(entries, templates); };
    btn.onclick = doSearch;
    inp.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
    setTimeout(() => inp?.focus(), 50);
  }

  // FAB — только в режиме day
  if (diaryMode === "day") {
    body.insertAdjacentHTML("beforeend",
      `<button class="fab" onclick="window.openNewModal('diary',null,null,'diary','${dstr(diaryDate)}')">+</button>`);
  } else {
    body.insertAdjacentHTML("beforeend",
      `<button class="fab" onclick="window.openNewModal('diary',null,null,'diary')">+</button>`);
  }
}

// ── Карточка записи дневника ──
function diaryCard(x) {
  const moodIcon = x.mood ? `<span class="ic-tag" style="background:rgba(200,150,62,.1)">${x.mood.split(" ")[0]}</span>` : "";
  const tagsHtml = Array.isArray(x.tags) && x.tags.length
    ? x.tags.map(t => `<span class="ic-tag ic-tag-diary-tag">#${esc(t)}</span>`).join("")
    : "";
  return `
    <div class="icard" onclick="window.editDiary('${x.id}')">
      <div class="ic-body">
        <div class="ic-ttl">${esc(x.title || "Без заголовка")}</div>
        ${x.text ? `<div style="font-size:12px;color:var(--tx-m);margin-top:4px">${esc(x.text.slice(0,130))}${x.text.length>130?"…":""}</div>` : ""}
        <div class="ic-meta">
          <span class="ic-tag tag-dl">${x.date || ""} ${x.time || ""}</span>
          ${moodIcon}
          ${tagsHtml}
        </div>
      </div>
      <div class="ic-acts">
        <button class="ib del" onclick="event.stopPropagation();window.delItem('diary','${x.id}')">🗑</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════
export async function renderDiary() {
  document.getElementById("tb-ttl").textContent = "Дневник";
  const [entries, templates] = await Promise.all([getDiary(), getTemplates()]);
  renderDiarySidebar(entries, templates);
  renderDiaryMain(entries, templates);
}

// ── Глобальные хэндлеры ──
window._diaryMode = async mode => {
  diaryMode = mode;
  if (mode !== "search") searchTag = "";
  const [entries, templates] = await Promise.all([getDiary(), getTemplates()]);
  renderDiarySidebar(entries, templates);
  renderDiaryMain(entries, templates);
};

// Клик по тегу в облаке — сразу ищем
window._diarySearchTag = async tag => {
  searchTag = tag;
  const [entries, templates] = await Promise.all([getDiary(), getTemplates()]);
  renderDiaryMain(entries, templates);
};

window._useTmpl = async id => {
  const all = await getTemplates();
  const t   = all.find(x => x.id === id);
  if (!t) return;
  buildDiaryModal("Новая запись в дневник", t, dstr(diaryDate));
};
