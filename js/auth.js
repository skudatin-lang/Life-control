// =============================================
//  AUTH MODULE
//  Google OAuth — встроен в Firebase
//  Яндекс OAuth — через OAuthProvider
// =============================================

import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let onLoginCallback  = null;
let onLogoutCallback = null;

export function setAuthCallbacks(onLogin, onLogout) {
  onLoginCallback  = onLogin;
  onLogoutCallback = onLogout;
}

onAuthStateChanged(auth, (user) => {
  if (user) { onLoginCallback?.(user);  }
  else       { onLogoutCallback?.();     }
});

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

export async function loginWithYandex() {
  const provider = new OAuthProvider("yandex.com");
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert("Для входа через Яндекс нужно настроить Yandex OAuth в Firebase Console.\nСм. инструкцию в README.md");
  }
}

export async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}
