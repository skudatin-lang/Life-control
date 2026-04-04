// =============================================
//  MODULE: МЕСТО ХАОСА
// =============================================

import { registerModule } from "../router.js";
import { showToast } from "../modal.js";
import { getChaosItems, addChaosItem, deleteChaosItem } from "../db.js";

const container = document.getElementById("module-chaos");

async function render() {
  container.innerHTML = `
    <div class="chaos-intro">
      <div class="chaos-intro-icon">↯</div>
      <div class="chaos-intro-text">
        <div class="chaos-intro-title">Место Хаоса</div>
        <div class="chaos-intro-desc">Записывай всё, что приходит в голову. Разберёшь позже.</div>
      </div>
    </div>
    <div class="chaos-quick-add">
      <input class="input" id="chaos-input" placeholder="Быстрая запись идеи или задачи..." />
      <button class="btn btn-primary" id="chaos-add-btn">+</button>
    </div>
    <div class="section-header">
      <span class="section-title" id="chaos-count">Загрузка...</span>
    </div>
    <div class="chaos-list" id="chaos-list">
      <div class="empty-state"><div class="empty-state-icon">↯</div><p>Загрузка...</p></div>
    </div>
    <div style="height:40px"></div>`;

  const input  = document.getElementById("chaos-input");
  const addBtn = document.getElementById("chaos-add-btn");

  async function doAdd() {
    const text = input.value.trim();
    if (!text) return;
    await addChaosItem(text);
    input.value = "";
    showToast("Записано в Хаос");
    await loadItems();
  }

  addBtn.addEventListener("click", doAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });
  await loadItems();
}

async function loadItems() {
  const items   = await getChaosItems();
  const countEl = document.getElementById("chaos-count");
  const listEl  = document.getElementById("chaos-list");
  if (!countEl || !listEl) return;

  countEl.textContent = items.length
    ? `${items.length} запис${items.length === 1 ? "ь" : items.length < 5 ? "и" : "ей"}`
    : "Записей нет";

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">↯</div><p>Здесь будут твои спонтанные идеи</p></div>`;
    return;
  }

  listEl.innerHTML = items.map(item => {
    const d = item.createdAt?.toDate?.() || new Date();
    const ds = `${d.getDate()}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `<div class="chaos-item" data-id="${item.id}">
      <div class="chaos-item-body">
        <div class="chaos-item-text">${esc(item.text)}</div>
        <div class="chaos-item-date">${ds}</div>
      </div>
      <div class="chaos-actions">
        <button class="task-btn del" data-id="${item.id}">✕</button>
      </div>
    </div>`;
  }).join("");

  listEl.querySelectorAll(".task-btn.del").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить запись?")) return;
      await deleteChaosItem(btn.dataset.id);
      showToast("Удалено");
      await loadItems();
    });
  });
}

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

export function initChaos() {
  registerModule("chaos", render);
}
