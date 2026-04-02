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
  Save,
  Target,
  Sparkles,
  TimerReset,
  LogIn,
  LogOut,
  CalendarDays,
  Cloud,
} from "lucide-react";
import { auth, provider, db } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const STORAGE_KEY = "waqti-app-v3";

const createEmptySections = () => [
  { id: "section-1", title: "الفجر → الظهر", tasks: [] },
  { id: "section-2", title: "الظهر → العصر", tasks: [] },
  { id: "section-3", title: "العصر → المغرب", tasks: [] },
  { id: "section-4", title: "المغرب → العشاء", tasks: [] },
  { id: "section-5", title: "العشاء → الفجر", tasks: [] },
];

const createEmptyPlan = () => ({
  tasksBySection: createEmptySections(),
  goals: {
    daily: "",
    weekly: "",
    yearly: "",
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
});

const defaultData = {
  streak: 0,
  lastCompletedDate: null,
  selectedDate: "",
  plansByDate: {},
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

function parseLegacyTime(time = "") {
  const match = time.match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
  return {
    startTime: match?.[1] || "",
    endTime: match?.[2] || "",
  };
}

function normalizeTask(task) {
  if (task.startTime || task.endTime) {
    return {
      id: task.id || `task-${Date.now()}`,
      label: task.label || "مهمة",
      startTime: task.startTime || "",
      endTime: task.endTime || "",
      done: !!task.done,
    };
  }

  const legacy = parseLegacyTime(task.time || "");
  return {
    id: task.id || `task-${Date.now()}`,
    label: task.label || "مهمة",
    startTime: legacy.startTime,
    endTime: legacy.endTime,
    done: !!task.done,
  };
}

function normalizeSections(sections) {
  const base = createEmptySections();
  if (!Array.isArray(sections) || !sections.length) return base;

  return sections.map((section, index) => ({
    id: section.id || `section-${index + 1}`,
    title: section.title || base[index]?.title || `قسم ${index + 1}`,
    tasks: Array.isArray(section.tasks) ? section.tasks.map(normalizeTask) : [],
  }));
}

function normalizePlan(plan) {
  const empty = createEmptyPlan();
  return {
    tasksBySection: normalizeSections(plan?.tasksBySection),
    goals: {
      daily: plan?.goals?.daily || "",
      weekly: plan?.goals?.weekly || "",
      yearly: plan?.goals?.yearly || "",
    },
    adhkar: {
      morning: Array.isArray(plan?.adhkar?.morning) ? plan.adhkar.morning : empty.adhkar.morning,
      evening: Array.isArray(plan?.adhkar?.evening) ? plan.adhkar.evening : empty.adhkar.evening,
    },
    tasbih: typeof plan?.tasbih === "number" ? plan.tasbih : 0,
  };
}

function buildInitialData(rawParsed) {
  const today = getTodayKey();
  const parsed = rawParsed || {};

  if (parsed.tasksBySection || parsed.goals || parsed.adhkar || typeof parsed.tasbih === "number") {
    return {
      streak: parsed.streak || 0,
      lastCompletedDate: parsed.lastCompletedDate || null,
      selectedDate: today,
      plansByDate: {
        [today]: normalizePlan(parsed),
      },
    };
  }

  const plansByDate = { ...(parsed.plansByDate || {}) };
  if (!plansByDate[today]) plansByDate[today] = createEmptyPlan();

  const normalizedPlans = Object.fromEntries(
    Object.entries(plansByDate).map(([date, plan]) => [date, normalizePlan(plan)])
  );

  return {
    streak: parsed.streak || 0,
    lastCompletedDate: parsed.lastCompletedDate || null,
    selectedDate: parsed.selectedDate || today,
    plansByDate: normalizedPlans,
  };
}

function loadState() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return buildInitialData(defaultData);
    const parsed = JSON.parse(raw);
    return buildInitialData(parsed);
  } catch {
    return buildInitialData(defaultData);
  }
}

function formatTaskTime(task) {
  if (!task.startTime && !task.endTime) return "بدون وقت";
  if (task.startTime && task.endTime) return `${task.startTime} - ${task.endTime}`;
  return task.startTime || task.endTime;
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

            <div style={{ display: "grid", gap: 10 }}>
              <input
                className="input"
                value={task.label}
                onChange={(e) => onUpdateTask(task.id, { label: e.target.value })}
                placeholder="اسم المهمة"
              />

              <div className="grid-2">
                <div>
                  <div className="text-sm muted mb-2">من</div>
                  <input
                    className="input"
                    type="time"
                    dir="ltr"
                    value={task.startTime || ""}
                    onChange={(e) => onUpdateTask(task.id, { startTime: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-sm muted mb-2">إلى</div>
                  <input
                    className="input"
                    type="time"
                    dir="ltr"
                    value={task.endTime || ""}
                    onChange={(e) => onUpdateTask(task.id, { endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="text-sm muted">{formatTaskTime(task)}</div>
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
  const [syncStatus, setSyncStatus] = useState("idle");

  const selectedDate = data.selectedDate || getTodayKey();
  const currentPlan = data.plansByDate?.[selectedDate] || createEmptyPlan();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser || null);

      if (currentUser) {
        try {
          const ref = doc(db, "users", currentUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setData(buildInitialData(snap.data()));
          }
        } catch (error) {
          console.error("Load user data error:", error);
        }
      }

      setReady(true);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!ready) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const saveToCloud = async () => {
      if (!user) return;
      try {
        setSyncStatus("saving");
        await setDoc(doc(db, "users", user.uid), data, { merge: true });
        setSyncStatus("saved");
      } catch (error) {
        console.error("Firestore save error:", error);
        setSyncStatus("error");
      }
    };

    saveToCloud();
  }, [data, user, ready]);

  const updateCurrentPlan = (updater) => {
    setData((prev) => ({
      ...prev,
      plansByDate: {
        ...prev.plansByDate,
        [prev.selectedDate]: updater(prev.plansByDate?.[prev.selectedDate] || createEmptyPlan()),
      },
    }));
  };

  const allTasks = useMemo(() => currentPlan.tasksBySection.flatMap((section) => section.tasks), [currentPlan]);
  const completedTasks = useMemo(() => allTasks.filter((task) => task.done).length, [allTasks]);
  const progress = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;
  const allDone = allTasks.length > 0 && completedTasks === allTasks.length;

  useEffect(() => {
    if (!allDone) return;
    setData((prev) => {
      if (prev.lastCompletedDate === prev.selectedDate) return prev;
      let nextStreak = 1;
      if (prev.lastCompletedDate && isYesterday(prev.selectedDate, prev.lastCompletedDate)) nextStreak = prev.streak + 1;
      return { ...prev, streak: nextStreak, lastCompletedDate: prev.selectedDate };
    });
  }, [allDone]);

  const setSelectedDate = (date) => {
    setData((prev) => ({
      ...prev,
      selectedDate: date,
      plansByDate: {
        ...prev.plansByDate,
        [date]: prev.plansByDate?.[date] ? normalizePlan(prev.plansByDate[date]) : createEmptyPlan(),
      },
    }));
  };

  const updateSection = (sectionId, updater) => {
    updateCurrentPlan((plan) => ({
      ...plan,
      tasksBySection: plan.tasksBySection.map((section) => section.id === sectionId ? updater(section) : section),
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
    tasks: [
      ...section.tasks,
      {
        id: `${sectionId}-${Date.now()}`,
        label: "مهمة جديدة",
        startTime: "",
        endTime: "",
        done: false,
      },
    ],
  }));

  const deleteTask = (sectionId, taskId) => updateSection(sectionId, (section) => ({
    ...section,
    tasks: section.tasks.filter((task) => task.id !== taskId),
  }));

  const resetTasksOnly = () => updateCurrentPlan((plan) => ({
    ...plan,
    tasksBySection: plan.tasksBySection.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => ({ ...task, done: false })),
    })),
  }));

  const updateGoal = (key, value) => updateCurrentPlan((plan) => ({
    ...plan,
    goals: { ...plan.goals, [key]: value },
  }));

  const updateDhikrGroup = (group, updater) => updateCurrentPlan((plan) => ({
    ...plan,
    adhkar: { ...plan.adhkar, [group]: updater(plan.adhkar[group]) },
  }));

  const incrementDhikr = (group, id) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, count: item.count + 1 } : item));
  const resetDhikr = (group) => updateDhikrGroup(group, (items) => items.map((item) => ({ ...item, count: 0 })));
  const addDhikr = (group) => updateDhikrGroup(group, (items) => [...items, { id: `${group}-${Date.now()}`, text: "ذكر جديد", target: 3, count: 0 }]);
  const deleteDhikr = (group, id) => updateDhikrGroup(group, (items) => items.filter((item) => item.id !== id));
  const updateDhikrText = (group, id, text) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, text } : item));
  const updateDhikrTarget = (group, id, target) => updateDhikrGroup(group, (items) => items.map((item) => item.id === id ? { ...item, target: Math.max(1, target) } : item));

  const completedMorning = currentPlan.adhkar.morning.filter((item) => item.count >= item.target).length;
  const completedEvening = currentPlan.adhkar.evening.filter((item) => item.count >= item.target).length;

  const handleLogout = async () => {
    try {
      if (user) {
        setSyncStatus("saving");
        await setDoc(doc(db, "users", user.uid), data, { merge: true });
      }
      await signOut(auth);
      setSyncStatus("idle");
    } catch (error) {
      console.error("Logout sync error:", error);
      setSyncStatus("error");
    }
  };

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
                  منصة عربية حديثة لإدارة اليوم بين الصلاة والانضباط، مع تخطيط حقيقي حسب التاريخ، وأهداف يومية وأسبوعية وسنوية، وأذكار الصباح والمساء، ومسبحة إلكترونية.
                </p>
              </div>

              <div className="flex gap-2">
                {user ? (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <img src={user.photoURL} alt="user" className="w-8 h-8 rounded-full" />
                    <div>
                      <div className="text-sm font-medium">{user.displayName}</div>
                      <div className="text-xs muted">
                        {syncStatus === "saving" && "جاري الحفظ..."}
                        {syncStatus === "saved" && "تم الحفظ"}
                        {syncStatus === "error" && "فشل الحفظ"}
                      </div>
                    </div>
                    <button onClick={handleLogout} className="btn"><LogOut size={16} /> خروج</button>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => signInWithPopup(auth, provider)}>
                    <LogIn size={16} /> تسجيل دخول بجوجل
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm muted">إنجاز اليوم</span>
              <span className="text-2xl font-bold">{progress}%</span>
            </div>
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="badge btn-soft"><Flame size={16} /> الاستمرارية: {data.streak}</div>
              <button className="btn" onClick={resetTasksOnly}><RotateCcw size={16} /> تصفير مهام هذا اليوم</button>
            </div>
          </div>
        </motion.div>

        <div className="card p-5 mb-6">
          <div className="mb-4 flex items-center gap-2"><CalendarDays size={18} /><h2 className="text-xl font-bold">التخطيط حسب التاريخ</h2></div>
          <div className="grid-2">
            <div>
              <div className="text-sm muted mb-2">اختر اليوم</div>
              <input
                className="input"
                type="date"
                dir="ltr"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <div className="text-sm muted mb-2">حالة المزامنة</div>
              <div className="badge"><Cloud size={16} /> {user ? (syncStatus === "saved" ? "الحساب متزامن" : syncStatus === "saving" ? "جاري رفع التعديلات" : syncStatus === "error" ? "في مشكلة بالحفظ" : "جاهز") : "أنت تعمل محليًا حتى تسجل الدخول"}</div>
            </div>
          </div>
        </div>

        <div className="grid-4 mb-6">
          <StatCard icon={Target} label="المهام المكتملة" value={`${completedTasks}/${allTasks.length}`} sub="كل يوم له خطته الخاصة" />
          <StatCard icon={Sparkles} label="أذكار الصباح" value={`${completedMorning}/${currentPlan.adhkar.morning.length}`} sub="عداد تكرار لكل ذكر" />
          <StatCard icon={Sparkles} label="أذكار المساء" value={`${completedEvening}/${currentPlan.adhkar.evening.length}`} sub="إضافة وتعديل الأذكار متاح" />
          <StatCard icon={TimerReset} label="المسبحة الإلكترونية" value={currentPlan.tasbih} sub="عداد نقر بسيط وسريع" />
        </div>

        <div className="grid-2-1 mb-6">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Target size={18} /><h2 className="text-xl font-bold">الأهداف</h2></div>
            <div className="grid-3">
              <div>
                <div className="text-sm muted mb-4">الهدف اليومي</div>
                <textarea className="textarea" rows="5" value={currentPlan.goals.daily} onChange={(e) => updateGoal("daily", e.target.value)} />
              </div>
              <div>
                <div className="text-sm muted mb-4">الهدف الأسبوعي</div>
                <textarea className="textarea" rows="5" value={currentPlan.goals.weekly} onChange={(e) => updateGoal("weekly", e.target.value)} />
              </div>
              <div>
                <div className="text-sm muted mb-4">الهدف السنوي</div>
                <textarea className="textarea" rows="5" value={currentPlan.goals.yearly} onChange={(e) => updateGoal("yearly", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2"><Save size={18} /><h2 className="text-xl font-bold">المسبحة الإلكترونية</h2></div>
            <div className="center-box">
              <div className="text-sm muted">العدد الحالي</div>
              <div className="text-6xl font-black">{currentPlan.tasbih}</div>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button className="btn btn-primary" onClick={() => updateCurrentPlan((plan) => ({ ...plan, tasbih: plan.tasbih + 1 }))}>تسبيح +1</button>
                <button className="btn" onClick={() => updateCurrentPlan((plan) => ({ ...plan, tasbih: 0 }))}>تصفير</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-4 flex items-center gap-2"><Save size={18} /><h2 className="text-2xl font-bold">خطة اليوم القابلة للتعديل</h2></div>
          <div className="grid-3">
            {currentPlan.tasksBySection.map((section) => (
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
            items={currentPlan.adhkar.morning}
            onIncrement={(id) => incrementDhikr("morning", id)}
            onReset={() => resetDhikr("morning")}
            onTextChange={(id, text) => updateDhikrText("morning", id, text)}
            onTargetChange={(id, target) => updateDhikrTarget("morning", id, target)}
            onAdd={() => addDhikr("morning")}
            onDelete={(id) => deleteDhikr("morning", id)}
          />
          <DhikrCard
            title="أذكار المساء"
            items={currentPlan.adhkar.evening}
            onIncrement={(id) => incrementDhikr("evening", id)}
            onReset={() => resetDhikr("evening")}
            onTextChange={(id, text) => updateDhikrText("evening", id, text)}
            onTargetChange={(id, target) => updateDhikrTarget("evening", id, target)}
            onAdd={() => addDhikr("evening")}
            onDelete={(id) => deleteDhikr("evening", id)}
          />
        </div>

        <div className="card p-5 mt-8 footer-note text-sm muted">
          الوقت كالسيف إن لم تقطعه قطعك،
فابدأ اليوم… فالغد لا يُبنى بالتأجيل.
        </div>
      </div>
    </div>
  );
}
