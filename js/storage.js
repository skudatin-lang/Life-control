// ════════════════════════════════════════
//  STORAGE MODULE
//  js/storage.js
// ════════════════════════════════════════

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getUid } from "./db.js";

let storage = null;

// ИСПРАВЛЕНО: функция должна быть async, так как раньше внутри
// обычной функции использовался await — это вызывало SyntaxError.
export async function initStorage() {
  storage = getStorage(getApp());
}

export async function uploadAttachment(file, taskId) {
  const uid = getUid();
  if (!uid || !file) return null;
  const path = `users/${uid}/tasks/${taskId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { name: file.name, url, type: file.type, size: file.size };
}

export async function deleteAttachment(url) {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch(e) { console.warn(e); }
}
