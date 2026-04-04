// ═══════════════════════════════════════════════════
//  DB MODULE
//  Все операции с Firestore (CRUD)
//  Структура:
//    users/{uid}/tasks/{taskId}
//    users/{uid}/projects/{projectId}
//    users/{uid}/chaos/{chaosId}
// ═══════════════════════════════════════════════════

import { db } from "./firebase-config.js";
import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot,
  query, where, orderBy,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUid = null;

export function setUid(uid) { currentUid = uid; }
export function getUid()    { return currentUid; }

// ── helpers ──
function col(name) {
  return collection(db, "users", currentUid, name);
}
function docRef(name, id) {
  return doc(db, "users", currentUid, name, id);
}

// ══════════════════════════════
//  TASKS
// ══════════════════════════════

/**
 * Подписка на задачи (realtime)
 * @param {Function} callback  — вызывается при каждом изменении
 * @returns unsubscribe function
 */
export function subscribeToTasks(callback) {
  const q = query(col("tasks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(tasks);
  });
}

export async function addTask(data) {
  return addDoc(col("tasks"), {
    ...data,
    done: false,
    createdAt: serverTimestamp()
  });
}

export async function updateTask(id, data) {
  return updateDoc(docRef("tasks", id), data);
}

export async function deleteTask(id) {
  return deleteDoc(docRef("tasks", id));
}

export async function toggleTask(id, currentDone) {
  return updateDoc(docRef("tasks", id), {
    done: !currentDone,
    completedAt: !currentDone ? serverTimestamp() : null
  });
}

// ══════════════════════════════
//  PROJECTS / CATEGORIES
//  Тип хранится в поле `type`:
//    "category" — папка верхнего уровня
//    "project"  — вложенный проект
// ══════════════════════════════

export function subscribeToProjects(callback) {
  const q = query(col("projects"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(projects);
  });
}

export async function addProject(data) {
  return addDoc(col("projects"), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function updateProject(id, data) {
  return updateDoc(docRef("projects", id), data);
}

export async function deleteProject(id) {
  return deleteDoc(docRef("projects", id));
}

// ══════════════════════════════
//  CHAOS (Место Хаоса)
// ══════════════════════════════

export function subscribeToChaos(callback) {
  const q = query(col("chaos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function addChaosItem(text) {
  return addDoc(col("chaos"), {
    text,
    createdAt: serverTimestamp()
  });
}

export async function deleteChaosItem(id) {
  return deleteDoc(docRef("chaos", id));
}

// Преобразовать хаос-запись в задачу
export async function convertChaosToTask(chaosItem, taskData) {
  await addTask(taskData);
  await deleteChaosItem(chaosItem.id);
}

// ══════════════════════════════
//  UTILS
// ══════════════════════════════

/**
 * Форматирует Firebase Timestamp или строку даты в читаемый вид
 */
export function formatDate(value) {
  if (!value) return null;
  let date;
  if (value && value.toDate) {
    date = value.toDate();
  } else if (typeof value === "string") {
    date = new Date(value + "T00:00:00");
  } else {
    date = new Date(value);
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Проверяет, просрочена ли дата дедлайна
 */
export function isOverdue(deadline) {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(deadline + "T00:00:00");
  return d < today;
}

/**
 * Проверяет, попадает ли задача на конкретную дату (строка YYYY-MM-DD)
 */
export function taskOnDate(task, dateStr) {
  return task.deadline === dateStr;
}
