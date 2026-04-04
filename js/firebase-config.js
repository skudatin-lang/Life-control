// ═══════════════════════════════════════════════════
//  FIREBASE CONFIG
//  ⚠️  Замените значения ниже на СВОИ из Firebase Console
//  Инструкция: см. SETUP.md, Шаг 4
// ═══════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ▼▼▼ ВСТАВЬТЕ СЮДА СВОИ ДАННЫЕ ▼▼▼
const firebaseConfig = {
  apiKey:            "AIzaSyA5mVDOI7rINUKbSdjs2tGFbS9sfTaBNBQ",
  authDomain:        "life-control-70663.firebaseapp.com",
  projectId:         "life-control-70663",
  storageBucket:     "life-control-70663.firebasestorage.app",
  messagingSenderId: "418774873271",
  appId:             "1:418774873271:web:634a24c0f811cc55160932"
};
// ▲▲▲ КОНЕЦ ВАШЕЙ СЕКЦИИ ▲▲▲

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);
