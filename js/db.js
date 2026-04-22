// ════════════════════════════════════════
//  DATABASE MODULE
//  js/db.js
// ════════════════════════════════════════

import { db } from "./firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, writeBatch, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _uid = null;
export const setUid = uid => { _uid = uid; };
export const getUid = () => _uid;

export const uc = col => collection(db, "users", _uid, col);
export const ud = (col, id) => doc(db, "users", _uid, col, id);

export async function sg(q) {
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("sg error:", e);
    return [];
  }
}

const p2 = n => String(n).padStart(2, "0");
export const dstr = d => {
  if (!d) return "";
  const dt = d instanceof Date ? d : d.toDate ? d.toDate() : new Date(d);
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
};
export const fdt = d => {
  if (!d) return "";
  const dt = d instanceof Date ? d : d.toDate ? d.toDate() : new Date(d);
  return `${p2(dt.getDate())}.${p2(dt.getMonth() + 1)}.${dt.getFullYear()} ${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
};
export const today = () => dstr(new Date());
export const isOv = d => {
  if (!d) return false;
  const dt = d.toDate ? d.toDate() : new Date(d);
  return dt < new Date();
};
export const toTS = v => (v ? Timestamp.fromDate(new Date(v)) : null);
export const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const ss = () => serverTimestamp();

// ── Генерация повторяющихся задач ──
export async function generateRecurringInstances(parentTask, startDate, endDate) {
  if (!parentTask.recurrence || parentTask.recurrence.type === "none") return [];
  const { type, interval = 1, until } = parentTask.recurrence;
  const untilDate = until ? new Date(until) : new Date(endDate);
  const instances = [];
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(untilDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    let shouldAdd = false;
    switch (type) {
      case "daily":   shouldAdd = true; break;
      case "weekly":  shouldAdd = true; break;
      case "monthly": shouldAdd = current.getDate() === startDate.getDate(); break;
      case "yearly":  shouldAdd = current.getMonth() === startDate.getMonth() && current.getDate() === startDate.getDate(); break;
    }
    if (shouldAdd) {
      const newTask = { ...parentTask };
      delete newTask.id;
      delete newTask.createdAt;
      newTask.parentId   = parentTask.id;
      newTask.date       = dstr(current);
      newTask.recurrence = null;
      newTask.done       = false;
      newTask.createdAt  = ss();
      instances.push(newTask);
    }
    if      (type === "weekly")  current.setDate(current.getDate() + 7 * interval);
    else if (type === "monthly") current.setMonth(current.getMonth() + interval);
    else if (type === "yearly")  current.setFullYear(current.getFullYear() + interval);
    else                         current.setDate(current.getDate() + interval);
  }

  const existing = await sg(query(uc("tasks"), where("parentId", "==", parentTask.id)));
  const batch = writeBatch(db);
  existing.forEach(t => batch.delete(ud("tasks", t.id)));
  await batch.commit();

  for (const inst of instances) {
    await addDoc(uc("tasks"), inst);
  }
  return instances;
}

// ════════════════ TASKS ════════════════
export const getTasks = () => sg(uc("tasks"));

export const addTask = async data => {
  const taskData = {
    title:       data.title,
    note:        data.note        || "",
    goalId:      data.goalId      || null,
    projId:      data.projId      || null,
    priority:    data.priority    || "med",
    subtasks:    data.subtasks    || [],
    date:        data.date        || today(),
    deadline:    toTS(data.deadline),
    startDate:   toTS(data.startDate),
    done:        false,
    createdAt:   ss(),
    reminder:    data.reminder    ? toTS(data.reminder) : null,
    attachments: data.attachments || [],
    recurrence:  data.recurrence  || null,
    parentId:    data.parentId    || null,
    isPinned:    data.isPinned    || false,   // ← Фокус дня
    tags:        data.tags        || [],      // ← Теги
  };
  const docRef = await addDoc(uc("tasks"), taskData);
  if (data.recurrence && data.recurrence.type !== "none" && !data.parentId) {
    const start = data.startDate ? new Date(data.startDate) : new Date();
    const end   = data.deadline  ? new Date(data.deadline)  : new Date();
    await generateRecurringInstances({ ...taskData, id: docRef.id }, start, end);
  }
  return docRef;
};

export const updateTask = async (id, data) => {
  const payload = { ...data };
  if ("deadline"  in data) payload.deadline  = toTS(data.deadline);
  if ("startDate" in data) payload.startDate = toTS(data.startDate);
  if ("reminder"  in data) payload.reminder  = toTS(data.reminder);
  await updateDoc(ud("tasks", id), payload);
  if (data.recurrence && data.recurrence.type !== "none") {
    const parent = (await sg(query(uc("tasks"), where("parentId", "==", id)))).length ? null : { id };
    if (!parent) return;
    const fullTask = (await sg(query(uc("tasks"), where("__name__", "==", id))))[0];
    if (fullTask && fullTask.recurrence && fullTask.recurrence.type !== "none") {
      const start = fullTask.startDate ? fullTask.startDate.toDate() : new Date();
      const end   = fullTask.deadline  ? fullTask.deadline.toDate()  : new Date();
      await generateRecurringInstances(fullTask, start, end);
    }
  }
};

export const deleteTask = async id => {
  const children = await sg(query(uc("tasks"), where("parentId", "==", id)));
  const batch = writeBatch(db);
  children.forEach(c => batch.delete(ud("tasks", c.id)));
  batch.delete(ud("tasks", id));
  await batch.commit();
};

export const toggleTask = async id => {
  const all = await getTasks();
  const t = all.find(x => x.id === id);
  if (t) await updateDoc(ud("tasks", id), { done: !t.done });
};

// ════════════════ INBOX (Место Хаоса) ════════════════
export const getInbox       = ()   => sg(uc("inbox"));
export const addInbox       = data => addDoc(uc("inbox"), { ...data, createdAt: ss() });
export const deleteInboxItem = id  => deleteDoc(ud("inbox", id));

// ════════════════ GOALS / PROJECTS / IDEAS / DIARY / TEMPLATES ════════════════
export const getGoals    = ()       => sg(uc("goals"));
export const addGoal     = data     => addDoc(uc("goals"),    { ...data, createdAt: ss() });
export const deleteGoal  = id       => deleteDoc(ud("goals", id));
export const updateGoal  = (id, d)  => updateDoc(ud("goals", id), d);

export const getProjects   = ()       => sg(uc("projects"));
export const addProject    = data     => addDoc(uc("projects"), { ...data, createdAt: ss() });
export const deleteProject = id       => deleteDoc(ud("projects", id));

export const getIdeas    = ()       => sg(uc("ideas"));
export const addIdea     = data     => addDoc(uc("ideas"),    { ...data, date: data.date || today(), createdAt: ss() });
export const updateIdea  = (id, d)  => updateDoc(ud("ideas", id), d);
export const deleteIdea  = id       => deleteDoc(ud("ideas", id));

export const getDiary          = ()      => sg(uc("diary"));
export const addDiaryEntry     = data    => addDoc(uc("diary"),    { ...data, date: data.date || today(), createdAt: ss() });
export const updateDiaryEntry  = (id, d) => updateDoc(ud("diary", id), d);
export const deleteDiaryEntry  = id      => deleteDoc(ud("diary", id));

export const getTemplates  = ()      => sg(uc("templates"));
export const addTemplate   = data    => addDoc(uc("templates"), { ...data, createdAt: ss() });
export const deleteTemplate = id     => deleteDoc(ud("templates", id));

export const getWeekGoals = () => sg(uc("weekgoals"));
export const saveWeekGoal = async (field, value, id) => {
  const arr = await getWeekGoals();
  const wg  = arr[0];
  if (wg) await updateDoc(ud("weekgoals", wg.id), { [field]: value.trim() });
  else    await addDoc(uc("weekgoals"), { [field]: value.trim(), createdAt: ss() });
};

export const getMmPos  = ()           => sg(uc("mmpos"));
export const saveMmPos = async (nid, x, y) => {
  const arr = await getMmPos();
  const ex  = arr.find(p => p.nid === nid);
  if (ex) await updateDoc(ud("mmpos", ex.id), { x, y });
  else    await addDoc(uc("mmpos"), { nid, x, y });
};

export const getStats = async () => {
  const [tasks, goals, ideas, diary] = await Promise.all([getTasks(), getGoals(), getIdeas(), getDiary()]);
  const td = today();
  const tt = tasks.filter(t => t.date === td);
  return {
    tasks,
    goals,
    ideas,
    diary,
    todayOpen:  tt.filter(t => !t.done).length,
    todayDone:  tt.filter(t =>  t.done).length,
    overdue:    tasks.filter(t => !t.done && isOv(t.deadline)).length,
    todayTasks: tt,
  };
};
