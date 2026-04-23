// ════════════════════════════════════════
//  TAB: DASHBOARD — финальный дизайн
//  js/tabs/dashboard.js
// ════════════════════════════════════════

import { registerTab, taskCard } from "../router.js";
import { getStats, esc, getTasks, dstr, getInbox } from "../db.js";

const MGEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WD   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function initDashboard() { registerTab("dashboard", renderDashboard); }

// ── Эффективность: взвешенный % (high×3, med×1) ──
function calcEfficiency(tasks) {
  const w = { high: 3, med: 1, low: 1 };
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mt = tasks.filter(t => {
    const cd = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt || 0);
    return cd >= monthStart;
  });
  if (!mt.length) return 0;
  const total = mt.reduce((s, t) => s + (w[t.priority] || 1), 0);
  const done  = mt.filter(t => t.done).reduce((s, t) => s + (w[t.priority] || 1), 0);
  return total ? Math.round(done / total * 100) : 0;
}

// ── SVG кольцо прогресса ──
function progressRing(pct, size, stroke, color) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - pct / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}"
      fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}"
      fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${circ}" stroke-dashoffset="${fill}"
      stroke-linecap="round"
      transform="rotate(-90 ${size/2} ${size/2})"
      style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

export async function renderDashboard() {
  const el = document.getElementById("dash-body");
  if (!el) return;

  const [s, inbox] = await Promise.all([
    getStats(),
    getInbox().catch(() => []),
  ]);

  const d     = new Date(), h = d.getHours();
  const gr    = h<5?"Доброй ночи":h<12?"Доброе утро":h<17?"Добрый день":"Добрый вечер";
  const fname = (document.getElementById("sb-un")?.textContent||"").split(" ")[0]||"друг";
  const photo = document.getElementById("sb-av")?.querySelector("img")?.src || null;
  const initials = (document.getElementById("sb-un")?.textContent||"U")[0].toUpperCase();

  // Метрики месяца
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTasks = s.tasks.filter(t => {
    const cd = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt||0);
    return cd >= monthStart;
  });
  const monthPlanned = monthTasks.length;
  const monthDone    = monthTasks.filter(t => t.done).length;
  const efficiency   = calcEfficiency(s.tasks);

  // Задачи сегодня
  const todayOpen = s.todayTasks.filter(t => !t.done);
  const todayDone = s.todayTasks.filter(t =>  t.done);
  const total     = s.todayTasks.length;
  const pct       = total ? Math.round(todayDone.length / total * 100) : 0;
  const ringColor = pct >= 80 ? "var(--grn)" : pct >= 40 ? "var(--go)" : pct > 0 ? "var(--red)" : "var(--go)";

  // Дата для отображения
  const dateStr = `${WD[d.getDay()].toUpperCase()}, ${d.getDate()} ${MGEN[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;

  el.innerHTML = `
<div class="dash-layout">

  <!-- ═══ ЛЕВАЯ КОЛОНКА ═══ -->
  <div class="dash-left">

    <!-- Аватар + имя -->
    <div class="dash-avatar-block">
      ${photo
        ? `<img src="${photo}" class="dash-av-img" alt=""/>`
        : `<div class="dash-av-placeholder">${initials}</div>`}
      <div class="dash-av-name">${esc(fname)}</div>
      <div class="dash-av-date">${WD[d.getDay()]}, ${d.getDate()} ${MGEN[d.getMonth()]}</div>
    </div>

    <!-- Просроченные — огоньки -->
    ${s.overdue ? `
    <button class="dash-overdue" onclick="window.switchTab('plan')">
      🔥 ${s.overdue} просроченных
    </button>` : ""}

    <!-- Кольцо прогресса -->
    <div class="dash-ring-wrap" id="dash-ring-btn">
      <div class="dash-ring-svg">${progressRing(pct, 200, 14, ringColor)}</div>
      <div class="dash-ring-center">
        <div class="dash-ring-pct">${pct}%</div>
        <div class="dash-ring-sub">${todayDone.length} из ${total}</div>
      </div>
    </div>
    <div class="dash-ring-label">выполнить сегодня</div>

    <!-- Спейсер -->
    <div style="flex:1"></div>

    <!-- Кнопка добавить идею -->
    <button class="dash-idea-btn" onclick="window.quickCapture()">
      + Добавить идею
    </button>

  </div>

  <!-- ═══ ПРАВАЯ КОЛОНКА ═══ -->
  <div class="dash-right">

    <!-- Дата + приветствие -->
    <div class="dash-right-greet">
      <div class="drg-date">${dateStr}</div>
      <div class="drg-hello">${gr}, <span>${esc(fname)}</span></div>
    </div>

    <!-- 4 метрики — 2×2 -->
    <div class="dash-metrics">
      <div class="dash-metric" onclick="window.switchTab('plan')">
        <div class="dm-ico">📋</div>
        <div class="dm-val">${monthPlanned}</div>
        <div class="dm-lbl">запланировано</div>
      </div>
      <div class="dash-metric" onclick="window.switchTab('plan')">
        <div class="dm-ico">✅</div>
        <div class="dm-val">${monthDone}</div>
        <div class="dm-lbl">выполнено</div>
      </div>
      <div class="dash-metric" id="dm-inbox" onclick="window._toggleInboxPanel()">
        <div class="dm-ico">💡</div>
        <div class="dm-val">${inbox.length}</div>
        <div class="dm-lbl">банк идей</div>
        ${inbox.length ? `<div class="dm-badge">${inbox.length}</div>` : ""}
      </div>
      <div class="dash-metric">
        <div class="dm-ico">⚡</div>
        <div class="dm-val dash-eff">${efficiency}%</div>
        <div class="dm-lbl">эффективность</div>
      </div>
    </div>

    <!-- Банк идей (раскрывается по клику на метрику) -->
    <div id="dash-inbox-panel" class="dash-inbox-panel hidden">
      <div class="sec-lbl" style="margin-bottom:8px">💡 Банк идей</div>
      ${inbox.length === 0
        ? `<p style="font-size:12px;color:var(--tx-l)">Пусто — добавьте первую идею кнопкой слева</p>`
        : inbox.map(item => `
          <div class="inbox-item">
            <span class="inbox-txt">${esc(item.text||"—")}</span>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="ib" title="Создать задачу"
                onclick="window._processInbox('${item.id}',${JSON.stringify(item.text||"")})">→</button>
              <button class="ib del" title="Удалить"
                onclick="window._dismissInbox('${item.id}')">✕</button>
            </div>
          </div>`).join("")}
    </div>

    <!-- Список задач на сегодня -->
    <div id="dash-tasks-default">
      <div class="sec-lbl">Задачи на сегодня</div>
      ${total === 0
        ? `<div class="empty"><div class="ei">📋</div><p>На сегодня задач нет</p></div>`
        : todayOpen.map(t => taskCard(t, s.goals, [])).join("") +
          (todayDone.length
            ? `<div class="sec-lbl" style="margin-top:12px">Выполнено (${todayDone.length})</div>`
              + todayDone.map(t => taskCard(t, s.goals, [])).join("")
            : "")}
    </div>

  </div>
</div>

<button class="fab" onclick="window.openNewModal('task',null,null,'dashboard')">+</button>`;

  // ── Тогл банка идей ──
  window._toggleInboxPanel = () => {
    document.getElementById("dash-inbox-panel")?.classList.toggle("hidden");
  };
}
