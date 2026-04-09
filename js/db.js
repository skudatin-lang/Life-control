// ════════════════════════════════════════
//  DATABASE MODULE
//  js/db.js
//  Все операции с Firestore
// ════════════════════════════════════════

import { db } from "./firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _uid = null;
export const setUid  = uid  => { _uid = uid; };
export const getUid  = ()   => _uid;

// ── Helpers ──
export const uc  = col     => collection(db, "users", _uid, col);
export const ud  = (col,id) => doc(db, "users", _uid, col, id);

export async function sg(q) {
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    console.warn("sg error:", e.code);
    return [];
  }
}

// ── Date helpers ──
const p2  = n => String(n).padStart(2, "0");
export const dstr = d => {
  if (!d) return "";
  const dt = d instanceof Date ? d : d.toDate ? d.toDate() : new Date(d);
  return `${dt.getFullYear()}-${p2(dt.getMonth()+1)}-${p2(dt.getDate())}`;
};
export const fdt = d => {
  if (!d) return "";
  const dt = d instanceof Date ? d : d.toDate ? d.toDate() : new Date(d);
  return `${p2(dt.getDate())}.${p2(dt.getMonth()+1)}.${dt.getFullYear()}. ${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
};
export const today  = () => dstr(new Date());
export const isOv   = d  => { if (!d) return false; const dt = d.toDate ? d.toDate() : new Date(d); return dt < new Date(); };
export const toTS   = v  => v ? Timestamp.fromDate(new Date(v)) : null;
export const esc    = s  => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const ss     = () => serverTimestamp();

// ════════════════ TASKS ════════════════
export const getTasks      = ()       => sg(uc("tasks"));
export const getTasksToday = async () => {
  const all = await sg(uc("tasks"));
  return all.filter(t => t.date === today());
};
export const addTask = data => addDoc(uc("tasks"), {
  title:     data.title,
  note:      data.note      || "",
  goalId:    data.goalId    || null,
  projId:    data.projId    || null,
  priority:  data.priority  || "med",
  subtasks:  data.subtasks  || [],
  date:      today(),
  deadline:  toTS(data.deadline),
  startDate: toTS(data.startDate),
  done:      false,
  createdAt: ss()
});
export const updateTask = (id, data) => {
  const payload = { ...data };
  if ("deadline"  in data) payload.deadline  = toTS(data.deadline);
  if ("startDate" in data) payload.startDate = toTS(data.startDate);
  return updateDoc(ud("tasks", id), payload);
};
export const deleteTask   = id => deleteDoc(ud("tasks", id));
export const toggleTask   = async id => {
  const all = await sg(uc("tasks"));
  const t   = all.find(x => x.id === id);
  if (t) await updateDoc(ud("tasks", id), { done: !t.done });
};

// ════════════════ GOALS ════════════════
export const getGoals    = ()      => sg(uc("goals"));
export const addGoal     = data    => addDoc(uc("goals"), { ...data, createdAt: ss() });
export const deleteGoal  = id      => deleteDoc(ud("goals", id));
export const updateGoal  = (id, d) => updateDoc(ud("goals", id), d);

// ════════════════ PROJECTS ════════════════
export const getProjects   = ()      => sg(uc("projects"));
export const addProject    = data    => addDoc(uc("projects"), { ...data, createdAt: ss() });
export const deleteProject = id      => deleteDoc(ud("projects", id));

// ════════════════ IDEAS ════════════════
export const getIdeas   = ()      => sg(uc("ideas"));
export const addIdea    = data    => addDoc(uc("ideas"), { ...data, date: today(), createdAt: ss() });
export const updateIdea = (id, d) => updateDoc(ud("ideas", id), d);
export const deleteIdea = id      => deleteDoc(ud("ideas", id));

// ════════════════ DIARY ════════════════
export const getDiary        = ()      => sg(uc("diary"));
export const addDiaryEntry   = data    => addDoc(uc("diary"), { ...data, date: today(), createdAt: ss() });
export const updateDiaryEntry= (id, d) => updateDoc(ud("diary", id), d);
export const deleteDiaryEntry= id      => deleteDoc(ud("diary", id));

// ════════════════ TEMPLATES ════════════════
export const getTemplates   = ()      => sg(uc("templates"));
export const addTemplate    = data    => addDoc(uc("templates"), { ...data, createdAt: ss() });
export const deleteTemplate = id      => deleteDoc(ud("templates", id));

// ════════════════ WEEK GOALS ════════════════
export const getWeekGoals = () => sg(uc("weekgoals"));
export const saveWeekGoal = async (field, value) => {
  const arr = await sg(uc("weekgoals"));
  const wg  = arr[0];
  if (wg) await updateDoc(ud("weekgoals", wg.id), { [field]: value.trim() });
  else    await addDoc(uc("weekgoals"), { [field]: value.trim(), createdAt: ss() });
};

// ════════════════ MIND MAP POSITIONS ════════════════
export const getMmPos   = ()         => sg(uc("mmpos"));
export const saveMmPos  = async (nid, x, y) => {
  const arr = await sg(uc("mmpos"));
  const ex  = arr.find(p => p.nid === nid);
  if (ex) await updateDoc(ud("mmpos", ex.id), { x, y });
  else    await addDoc(uc("mmpos"), { nid, x, y });
};

// ════════════════ STATS ════════════════
export const getStats = async () => {
  const [tasks, goals, ideas, diary] = await Promise.all([
    getTasks(), getGoals(), getIdeas(), getDiary()
  ]);
  const td    = today();
  const tt    = tasks.filter(t => t.date === td);
  return {
    tasks,  goals,  ideas,  diary,
    todayOpen: tt.filter(t => !t.done).length,
    todayDone: tt.filter(t =>  t.done).length,
    overdue:   tasks.filter(t => !t.done && isOv(t.deadline)).length,
    todayTasks: tt
  };
};
