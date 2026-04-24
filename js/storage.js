// ════════════════════════════════════════
//  STORAGE MODULE
//  js/storage.js
// ════════════════════════════════════════

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getUid } from "./db.js";

let storage = null;

// Исправлено: убран await внутри обычной функции — getApp() синхронный
export function initStorage() {
  storage = getStorage(getApp());
}

export async function uploadAttachment(file, taskId) {
  const uid = getUid();
  if (!uid || !file) return null;
  if (!storage) { console.warn("Storage not initialized"); return null; }
  const path = `users/${uid}/tasks/${taskId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { name: file.name, url, type: file.type, size: file.size };
}

export async function deleteAttachment(url) {
  try {
    if (!storage) return;
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch(e) { console.warn(e); }
}
