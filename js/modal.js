// =============================================
//  MODAL UTILITY + TOAST
// =============================================

const overlay  = document.getElementById("modal-overlay");
const titleEl  = document.getElementById("modal-title");
const bodyEl   = document.getElementById("modal-body");
const closeBtn = document.getElementById("modal-close");

export function openModal(title, bodyHTML) {
  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHTML;
  overlay.classList.remove("hidden");
}

export function closeModal() {
  overlay.classList.add("hidden");
  bodyEl.innerHTML = "";
}

closeBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

// ---- Toast ----
export function showToast(msg, duration = 2500) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), duration);
}
