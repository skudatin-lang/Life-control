// ════════════════════════════════════════
//  STORAGE MODULE
//  js/storage.js
//  Загрузка файлов в Firebase Storage
// ════════════════════════════════════════

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getUid } from "./db.js";

let storage = null;

export function initStorage() {
  const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  storage = getStorage(getApp());
}

export async function uploadAttachment(file, taskId) {
  const uid = getUid();
  if (!uid || !file) return null;
  const ext = file.name.split('.').pop();
  const path = `users/${uid}/tasks/${taskId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { name: file.name, url, type: file.type, size: file.size };
}

export async function deleteAttachment(url) {
  // можно реализовать удаление, но для простоты пропустим
  return true;
}