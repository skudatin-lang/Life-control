// =============================================
//  DB MODULE — Firestore CRUD
//  Структура:
//  users/{uid}/categories/{catId}
//  users/{uid}/projects/{projId}
//  users/{uid}/tasks/{taskId}
//  users/{uid}/chaos/{itemId}
// =============================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUid = null;

export function setCurrentUser(uid) { currentUid = uid; }

// ---- Helpers ----
function userCol(col) {
  return collection(db, "users", currentUid, col);
}
function userDoc(col, id) {
  return doc(db, "users", currentUid, col, id);
}

// =============================================
//  CATEGORIES
// =============================================
export async function getCategories() {
  try {
    const snap = await getDocs(query(userCol("categories"), orderBy("createdAt")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // Если индекс ещё не создан — без сортировки
    const snap = await getDocs(userCol("categories"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export async function addCategory(name) {
  return await addDoc(userCol("categories"), { name, createdAt: serverTimestamp() });
}

export async function deleteCategory(catId) {
  await deleteDoc(userDoc("categories", catId));
}

export async function updateCategory(catId, data) {
  await updateDoc(userDoc("categories", catId), data);
}

// =============================================
//  PROJECTS
// =============================================
export async function getProjects(catId = null) {
  try {
    let q = catId
      ? query(userCol("projects"), where("catId", "==", catId), orderBy("createdAt"))
      : query(userCol("projects"), orderBy("createdAt"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // Fallback без сортировки
    let q = catId
      ? query(userCol("projects"), where("catId", "==", catId))
      : userCol("projects");
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export async function addProject(name, catId) {
  return await addDoc(userCol("projects"), { name, catId: catId || null, createdAt: serverTimestamp() });
}

export async function deleteProject(projId) {
  await deleteDoc(userDoc("projects", projId));
}

export async function updateProject(projId, data) {
  await updateDoc(userDoc("projects", projId), data);
}

// =============================================
//  TASKS
// =============================================
export async function getTasks(projId = null) {
  try {
    let q = projId
      ? query(userCol("tasks"), where("projId", "==", projId), orderBy("createdAt"))
      : query(userCol("tasks"), orderBy("createdAt"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    let q = projId
      ? query(userCol("tasks"), where("projId", "==", projId))
      : userCol("tasks");
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export async function getTasksForDate(dateStr) {
  // dateStr: "2026-04-05"
  try {
    const snap = await getDocs(query(userCol("tasks"), orderBy("deadline")));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => {
        if (!t.deadline) return false;
        const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        return d.toISOString().slice(0, 10) === dateStr;
      });
  } catch (e) {
    const snap = await getDocs(userCol("tasks"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => {
        if (!t.deadline) return false;
        const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        return d.toISOString().slice(0, 10) === dateStr;
      });
  }
}

export async function getDatesWithTasks() {
  try {
    const snap = await getDocs(userCol("tasks"));
    const dates = new Set();
    snap.docs.forEach(d => {
      const t = d.data();
      if (t.deadline) {
        const dt = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        dates.add(dt.toISOString().slice(0, 10));
      }
    });
    return dates;
  } catch (e) {
    return new Set();
  }
}

export async function addTask(data) {
  const payload = {
    title:  data.title,
    projId: data.projId || null,
    catId:  data.catId  || null,
    done:   false,
    note:   data.note   || "",
    createdAt: serverTimestamp(),
  };
  if (data.deadline) {
    payload.deadline = Timestamp.fromDate(new Date(data.deadline));
  }
  return await addDoc(userCol("tasks"), payload);
}

export async function updateTask(taskId, data) {
  const payload = { ...data };
  if (data.deadline !== undefined) {
    payload.deadline = data.deadline
      ? Timestamp.fromDate(new Date(data.deadline))
      : null;
  }
  await updateDoc(userDoc("tasks", taskId), payload);
}

export async function deleteTask(taskId) {
  await deleteDoc(userDoc("tasks", taskId));
}

// =============================================
//  CHAOS ITEMS
// =============================================
export async function getChaosItems() {
  try {
    const snap = await getDocs(query(userCol("chaos"), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(userCol("chaos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
  }
}

export async function addChaosItem(text) {
  return await addDoc(userCol("chaos"), { text, createdAt: serverTimestamp() });
}

export async function deleteChaosItem(itemId) {
  await deleteDoc(userDoc("chaos", itemId));
}

export async function updateChaosItem(itemId, data) {
  await updateDoc(userDoc("chaos", itemId), data);
}

// =============================================
//  STATS (для dashboard)
// =============================================
export async function getStats() {
  try {
    const [cats, projs, tasks, chaos] = await Promise.all([
      getDocs(userCol("categories")),
      getDocs(userCol("projects")),
      getDocs(userCol("tasks")),
      getDocs(userCol("chaos")),
    ]);
    const allTasks  = tasks.docs.map(d => d.data());
    const today     = new Date().toISOString().slice(0, 10);
    const todayTasks = allTasks.filter(t => {
      if (!t.deadline) return false;
      const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
      return d.toISOString().slice(0, 10) === today;
    });
    return {
      categories: cats.size,
      projects:   projs.size,
      tasks:      allTasks.length,
      doneTasks:  allTasks.filter(t => t.done).length,
      todayTasks: todayTasks.length,
      chaosItems: chaos.size,
    };
  } catch (e) {
    console.error("getStats error:", e);
    return { categories:0, projects:0, tasks:0, doneTasks:0, todayTasks:0, chaosItems:0 };
  }
}
