// ═══════════════════════════════════════════════════
//  AUTH MODULE
//  Авторизация: Google + Яндекс (через OAuthProvider)
// ═══════════════════════════════════════════════════

import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showToast } from "./app.js";

// ── Google ──
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ── Яндекс ──
const yandexProvider = new OAuthProvider("yandex.com");

// ── Кнопки авторизации ──
document.getElementById("loginGoogle").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Google login error:", err);
    showToast("Ошибка входа через Google: " + err.message);
  }
});

document.getElementById("loginYandex").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, yandexProvider);
  } catch (err) {
    console.error("Yandex login error:", err);
    showToast("Ошибка входа через Яндекс: " + err.message);
  }
});

// ── Выход ──
document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (confirm("Выйти из аккаунта?")) {
    await signOut(auth);
  }
});

// ── Слушатель смены состояния авторизации ──
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
