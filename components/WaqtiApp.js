"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Flame,
  RotateCcw,
  Plus,
  Trash2,
  Pencil,
  Save,
  Target,
  Sparkles,
  TimerReset,
  LogIn,
  LogOut,
} from "lucide-react";
import { auth, provider, db } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = "waqti-app-v2";

const defaultData = {
  streak: 0,
  lastCompletedDate: null,
  dayKey: "",
  tasksBySection: [
    {
      id: "section-1",
      title: "من الفجر إلى الظهر",
      tasks: [
        { id: "fajr", time: "05:07 - 06:07", label: "صلاة الفجر", done: false },
        { id: "memorization", time: "06:07 - 08:07", label: "حفظ مع تدبر", done: false },
        { id: "workout", time: "08:07 - 09:37", label: "رياضة", done: false },
        { id: "roya", time: "09:37 - 11:37", label: "شغل رؤية ومجتمع", done: false },
        { id: "auraview-1", time: "11:37 - 12:52", label: "شغل Auraview", done: false },
      ],
    },
    {
      id: "section-2",
      title: "من الظهر إلى العصر",
      tasks: [
        { id: "dhuhr", time: "12:52 - 13:52", label: "صلاة الظهر", done: false },
        { id: "auraview-2", time: "13:52 - 16:25", label: "شغل Auraview", done: false },
      ],
    },
    {
      id: "section-3",
      title: "من العصر إلى المغرب",
      tasks: [
        { id: "asr", time: "16:25 - 17:25", label: "صلاة العصر", done: false },
        { id: "auraview-3", time: "17:25 - 18:37", label: "شغل Auraview", done: false },
        { id: "learning", time: "18:37 - 19:11", label: "تعلم / قراءة", done: false },
      ],
    },
    {
      id: "section-4",
      title: "من المغرب إلى العشاء",
      tasks: [
        { id: "maghrib", time: "19:11 - 20:11", label: "صلاة المغرب", done: false },
        { id: "quran", time: "20:11 - 20:37", label: "قراءة قرآن", done: false },
      ],
    },
    {
      id: "section-5",
      title: "من العشاء إلى الفجر",
      tasks: [
        { id: "isha", time: "20:37 - 21:37", label: "صلاة العشاء", done: false },
        { id: "sleep", time: "21:37 - 04:37 (+1)", label: "نوم", done: false },
        { id: "light-dhikr", time: "04:37 - 05:07", label: "أذكار / تعلم خفيف", done: false },
      ],
    },
  ],
  goals: {
    daily: "إنهاء أهم مهام اليوم بثبات وهدوء",
    weekly: "الالتزام بالنظام أغلب أيام الأسبوع",
    yearly: "بناء سنة متوازنة بين العبادة والعمل والتعلّم",
  },
  adhkar: {
    morning: [
      { id: "m-1", text: "سبحان الله وبحمده", target: 3, count: 0 },
      { id: "m-2", text: "أستغفر الله العظيم وأتوب إليه", target: 3, count: 0 },
      { id: "m-3", text: "اللهم بك أصبحنا وبك أمسينا", target: 1, count: 0 },
    ],
    evening: [
      { id: "e-1", text: "سبحان الله وبحمده", target: 3, count: 0 },
      { id: "e-2", text: "أعوذ بكلمات الله التامات من شر ما خلق", target: 3, count: 0 },
      { id: "e-3", text: "اللهم بك أمسينا وبك أصبحنا", target: 1, count: 0 },
    ],
  },
  tasbih: 0,
};

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isYesterday(currentDate, previousDate) {
  const a = new Date(currentDate);
  const b = new Date(previousDate);
  const diff = (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff) === 1;
}

function resetDailyState(data) {
  return {
    ...data,
    dayKey: getTodayKey(),
    tasksBySection: data.tasksBySection.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => ({ ...task, done: false })),
    })),
    adhkar: {
      morning: data.adhkar.morning.map((item) => ({ ...item, count: 0 })),
      evening: data.adhkar.evening.map((item) => ({ ...item, count: 0 })),
    },
    tasbih: 0,
  };
}

function loadState() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return resetDailyState(defaultData);
    const parsed = JSON.parse(raw);
    const merged = {
      ...defaultData,
      ...parsed,
      goals: { ...defaultData.goals, ...(parsed.goals || {}) },
      adhkar: {
        morning: parsed.adhkar?.morning || defaultData.adhkar.morning,
        evening: parsed.adhkar?.evening || defaultData.adhkar.evening,
      },
      tasksBySection: parsed.tasksBySection || defaultData.tasksBySection,
    };
    if (merged.dayKey !== getTodayKey()) return resetDailyState(merged);
    return merged;
  } catch {
    return resetDailyState(defaultData);
  }
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="badge" style={{ background: "rgba(255,255,255,0.05)" }}>
          <Icon size={18} />
        </div>
        <div>
          <div className="text-sm muted">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      </div>
      <div className="text-sm muted">{sub}</div>
    </div>
  );
}

function SectionEditor({ section, onChangeTitle, onAddTask, onUpdateTask, onDeleteTask, onToggleTask }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <input className="input" value={section.title} onChange={(e) => onChangeTitle(e.target.value)} />
        <button className="btn" onClick={onAddTask}><Plus size={16} /> مهمة</button>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {section.tasks.map((task) => (
          <div key={task.id} className={`section-task ${task.done ? "done" : ""}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <button className="btn" onClick={() => onToggleTask(task.id)}>
                {task.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                {task.done ? "مكتملة" : "غير مكتملة"}
              </button>
              <button className="btn btn-danger" onClick={() => onDeleteTask(task.id)}><Trash2 size={16} /></button>
            </div>
            <div className="grid-2">
              <input className="input" value={task.label} onChange={(e) => onUpdateTask(task.id, { label: e.target.value })} />
              <input className="input" dir="ltr" value={task.time} onChange={(e) => onUpdateTask(task.id, { time: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function DhikrCard({ title, items, onIncrement, onReset, onTextChange, onTargetChange, onAdd, onDelete }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="flex gap-2">
          <button className="btn" onClick={onAdd}><Plus size={16} /> إضافة</button>
          <button className="btn" onClick={onReset}><RotateCcw size={16} /> تصفير</button>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const done = item.count >= item.target;
          return (
            <div key={item.id} className={`section-task ${done ? "done" : ""}`}>
              <div className="grid-3 mb-4">
                <input className="input" value={item.text} onChange={(e) => onTextChange(item.id, e.target.value)} />
                <input className="input" type="number" min={1} value={item.target} onChange={(e) => onTargetChange(item.id, Number(e.target.value) || 1)} />
                <button className="btn btn-danger" onClick={() => onDelete(item.id)}><Trash2 size={16} /></button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm muted">التكرار: <strong>{item.count} / {item.target}</strong></div>
                <button className="btn btn-primary" onClick={() => onIncrement(item.id)}>عدّ الذكر</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WaqtiApp() {
  const [data, setData] = useState(() => loadState());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser || null);
      if (currentUser) {
        const ref = doc(db, "users", currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const remote = snap.data();
          setData(remote.dayKey !== getTodayKey() ? resetDailyState(remote) : remote);
        }
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (user) {
      setDoc(doc(db, "users", user.uid), data, { merge: true });
    }
  }, [data, user, ready]);

  const allTasks = useMemo(() => data.tasksBySection.flatMap((section) => section.tasks), [data.tasksBySection]);
  const completedTasks = useMemo(() => allTasks.filter((task) => task.done).length, [allTasks]);
  const progress = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;
  const allDone = allTasks.length > 0 && completedTasks === allTasks.length;

  useEffect(() => {
    if (!allDone) return;
    setData((prev) => {
      if (prev.lastCompletedDate === prev.dayKey) return prev;
      let nextStreak = 1;
      if (prev.lastCompletedDate && isYesterday(prev.dayKey, prev.lastCompletedDate)) nextStreak = prev.streak + 1;
      return { ...prev, streak: nextStreak, lastCompletedDate: prev.dayKey };
    });
  }, [allDone]);

  const updateSection = (sectionId, updater) => {
    setData((prev) => ({
      ...prev,
      tasksBySection: prev.tasksBySection.map((section) => section.id === sectionId ? updater(section) : section),
    }));
  };

  const toggleTask = (sectionId, taskId) => updateSection(sectionId, (section) => ({
    ...section,
    tasks: section.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task),
  }));

  const updateTask = (sectionId, taskId, patch) => updateSection(sectionId, (section) => ({
    ...section,
    tasks: section.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task),
  }));

  const addTask = (sectionId) => updateSection(sectionId, (section) => ({
    ...section,
    tasks: [...section.tasks, { id: `${sectionId}-${Date.now()}`, label: "مهمة جديدة", time: "00:00 - 00:00", done: false }],
  }));

  const deleteTask = (sectionId, taskId) => updateSection(sectionId, (section) => ({
    ...section,
    tasks: section.tasks.filter((task) => task.id !== taskId),
  }));

  const resetTasksOnly = () => setData((prev) => ({
    ...prev,
    tasksBySection: prev.tasksBySection.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => ({ ...task, done: false })),
    })),
  }));

  const updateGoal = (key, value) => setData((prev) => ({ ...prev, goals: { ...prev.goals, [key]: value } }));

  const updateDhikrGroup = (group, updater) => setData((prev) => ({
    ...prev,
    adhkar: { ...prev.adhkar, [group]: updater(prev.adhkar[group]) },
  }));

  const incrementDhikr = (group, id) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, count: item.count + 1 } : item));
  const resetDhikr = (group) => updateDhikrGroup(group, (items) => items.map((item) => ({ ...item, count: 0 })));
  const addDhikr = (group) => updateDhikrGroup(group, (items) => [...items, { id: `${group}-${Date.now()}`, text: "ذكر جديد", target: 3, count: 0 }]);
  const deleteDhikr = (group, id) => updateDhikrGroup(group, (items) => items.filter((item) => item.id !== id));
  const updateDhikrText = (group, id, text) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, text } : item));
  const updateDhikrTarget = (group, id, target) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, target: Math.max(1, target) } : item));

  const completedMorning = data.adhkar.morning.filter((item) => item.count >= item.target).length;
  const completedEvening = data.adhkar.evening.filter((item) => item.count >= item.target).length;

  return (
    <div className="page">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="header-grid mb-6">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm muted mb-4">منصة وقتي</p>
                <h1 className="title text-3xl font-black">وقتي</h1>
                <p className="hero-desc text-sm muted mt-3">
                  منصة عربية حديثة لإدارة اليوم بين الصلاة والانضباط، مع أهداف يومية وأسبوعية وسنوية، أذكار الصباح والمساء، ومسبحة إلكترونية — وكل شيء محفوظ على حسابك.
                </p>
              </div>
              <div className="flex gap-2">
              {user ? (
  <div className="flex items-center gap-3 px-3 py-2 rounded-2xl" style={{background: "rgba(255,255,255,0.05)"}}>
    <img 
      src={user.photoURL} 
      alt="user" 
      className="w-8 h-8 rounded-full"
    />
    <span className="text-sm font-medium">
      {user.displayName}
    </span>
    <button 
      onClick={() => signOut(auth)} 
      className="btn"
    >
      خروج
    </button>
  </div>
) : (
  <button 
    className="btn btn-primary" 
    onClick={() => signInWithPopup(auth, provider)}
  >
    <LogIn size={16} /> تسجيل دخول بجوجل
  </button>
)}
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-sm muted">إنجاز اليوم</span>
              <span className="text-2xl font-bold">{progress}%</span>
            </div>
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="badge btn-soft"><Flame size={16} /> الاستمرارية: {data.streak}</div>
              <button className="btn" onClick={resetTasksOnly}><RotateCcw size={16} /> تصفير المهام</button>
            </div>
          </div>
        </motion.div>

        <div className="grid-4 mb-6">
          <StatCard icon={Target} label="المهام المكتملة" value={`${completedTasks}/${allTasks.length}`} sub="يمكنك تعديل كل مهمة ووقتها" />
          <StatCard icon={Sparkles} label="أذكار الصباح" value={`${completedMorning}/${data.adhkar.morning.length}`} sub="عداد تكرار لكل ذكر" />
          <StatCard icon={Sparkles} label="أذكار المساء" value={`${completedEvening}/${data.adhkar.evening.length}`} sub="إضافة وتعديل الأذكار متاح" />
          <StatCard icon={TimerReset} label="المسبحة الإلكترونية" value={data.tasbih} sub="عداد نقر بسيط وسريع" />
        </div>

        <div className="grid-2-1 mb-6">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Target size={18} /><h2 className="text-xl font-bold">الأهداف</h2></div>
            <div className="grid-3">
              <div>
                <div className="text-sm muted mb-4">الهدف اليومي</div>
                <textarea className="textarea" rows="5" value={data.goals.daily} onChange={(e) => updateGoal("daily", e.target.value)} />
              </div>
              <div>
                <div className="text-sm muted mb-4">الهدف الأسبوعي</div>
                <textarea className="textarea" rows="5" value={data.goals.weekly} onChange={(e) => updateGoal("weekly", e.target.value)} />
              </div>
              <div>
                <div className="text-sm muted mb-4">الهدف السنوي</div>
                <textarea className="textarea" rows="5" value={data.goals.yearly} onChange={(e) => updateGoal("yearly", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Pencil size={18} /><h2 className="text-xl font-bold">المسبحة الإلكترونية</h2></div>
            <div className="center-box">
              <div className="text-sm muted">العدد الحالي</div>
              <div className="text-6xl font-black">{data.tasbih}</div>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button className="btn btn-primary" onClick={() => setData((prev) => ({ ...prev, tasbih: prev.tasbih + 1 }))}>تسبيح +1</button>
                <button className="btn" onClick={() => setData((prev) => ({ ...prev, tasbih: 0 }))}>تصفير</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-4 flex items-center gap-2"><Save size={18} /><h2 className="text-2xl font-bold">جدول اليوم القابل للتعديل</h2></div>
          <div className="grid-3">
            {data.tasksBySection.map((section) => (
              <SectionEditor
                key={section.id}
                section={section}
                onChangeTitle={(value) => updateSection(section.id, (s) => ({ ...s, title: value }))}
                onAddTask={() => addTask(section.id)}
                onUpdateTask={(taskId, patch) => updateTask(section.id, taskId, patch)}
                onDeleteTask={(taskId) => deleteTask(section.id, taskId)}
                onToggleTask={(taskId) => toggleTask(section.id, taskId)}
              />
            ))}
          </div>
        </div>

        <div className="grid-2">
          <DhikrCard
            title="أذكار الصباح"
            items={data.adhkar.morning}
            onIncrement={(id) => incrementDhikr("morning", id)}
            onReset={() => resetDhikr("morning")}
            onTextChange={(id, text) => updateDhikrText("morning", id, text)}
            onTargetChange={(id, target) => updateDhikrTarget("morning", id, target)}
            onAdd={() => addDhikr("morning")}
            onDelete={(id) => deleteDhikr("morning", id)}
          />
          <DhikrCard
            title="أذكار المساء"
            items={data.adhkar.evening}
            onIncrement={(id) => incrementDhikr("evening", id)}
            onReset={() => resetDhikr("evening")}
            onTextChange={(id, text) => updateDhikrText("evening", id, text)}
            onTargetChange={(id, target) => updateDhikrTarget("evening", id, target)}
            onAdd={() => addDhikr("evening")}
            onDelete={(id) => deleteDhikr("evening", id)}
          />
        </div>

        <div className="card p-5 mt-8 footer-note text-sm muted">
          كل البيانات تُحفَظ محليًا على حسابك عند تسجيل الدخول. إذا فتحت الموقع من جهاز آخر بنفس الحساب، سترى نفس الأهداف والمهام والأذكار والمسبحة.
        </div>
      </div>
    </div>
  );
}
