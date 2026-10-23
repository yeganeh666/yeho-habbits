"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sb } from "./supabase-browser";
import { monthLength, monthRange, toISO } from "./jalali";
import type { Goal, Habit, Todo } from "./types";

/* ---------- وضعیت همگام‌سازی (برای نشانگر بالای صفحه) ---------- */
type SyncState = { phase: "off" | "idle" | "syncing" | "ok" | "error"; message?: string; at?: number };
let syncState: SyncState = { phase: "idle" };
const listeners = new Set<() => void>();
const setSync = (s: SyncState) => { syncState = s; listeners.forEach((l) => l()); };
export const useSyncState = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => syncState, () => syncState);

export function toast(msg: string) { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: msg })); }

async function runSync(jy: number, jm: number): Promise<number> {
  setSync({ ...syncState, phase: "syncing" });
  try {
    const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jy, jm }) });
    const j = await r.json();
    if (j.status === "no_sheet" || j.status === "not_connected") { setSync({ phase: "off" }); return 0; }
    if (j.status === "error") { setSync({ phase: "error", message: j.message }); return 0; }
    setSync({ phase: "ok", at: Date.now(), message: j.status === "no_template" ? j.message : undefined });
    return (j.pulled ?? 0) as number;
  } catch {
    setSync({ phase: "error", message: "اتصال برقرار نشد" });
    return 0;
  }
}

/* ---------- داده‌های یک ماه شمسی ---------- */
export function useMonth(jy: number, jm: number) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ym = useRef({ jy, jm }); ym.current = { jy, jm };

  const load = useCallback(async () => {
    const { start, end } = monthRange(jy, jm);
    const db = sb();
    const [h, l, t, g] = await Promise.all([
      db.from("habits").select("*").order("sort").order("created_at"),
      db.from("habit_logs").select("habit_id,day,done").gte("day", start).lte("day", end),
      db.from("habit_targets").select("habit_id,target").eq("jy", jy).eq("jm", jm),
      db.from("goals").select("*").eq("jy", jy).eq("jm", jm).eq("deleted", false).order("created_at"),
    ]);
    const logMap: Record<string, boolean> = {};
    (l.data ?? []).forEach((x: any) => { if (x.done) logMap[`${x.habit_id}|${x.day}`] = true; });
    const hs = ((h.data ?? []) as Habit[]).filter((x) => !x.archived || Object.keys(logMap).some((k) => k.startsWith(x.id)));
    setHabits(hs); setLogs(logMap);
    setTargets(Object.fromEntries((t.data ?? []).map((x: any) => [x.habit_id, x.target])));
    setGoals((g.data ?? []) as Goal[]);
    setLoading(false);
  }, [jy, jm]);

  const requestSync = useCallback((delay = 1200) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { if ((await runSync(ym.current.jy, ym.current.jm)) > 0) load(); }, delay);
  }, [load]);

  useEffect(() => { setLoading(true); load().then(() => requestSync(300)); }, [load, requestSync]);
  useEffect(() => {
    const iv = setInterval(() => requestSync(0), 60_000);
    const vis = () => document.visibilityState === "visible" && requestSync(0);
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); clearTimeout(timer.current); };
  }, [requestSync]);

  const targetOf = (h: Habit) => targets[h.id] ?? h.monthly_target ?? monthLength(jy, jm);
  const isDone = (hid: string, day: string) => !!logs[`${hid}|${day}`];
  const countOf = (hid: string) => Object.keys(logs).filter((k) => k.startsWith(hid)).length;

  async function toggle(h: Habit, day: string) {
    const key = `${h.id}|${day}`, next = !logs[key];
    setLogs((p) => { const n = { ...p }; if (next) n[key] = true; else delete n[key]; return n; });
    const { error } = await sb().from("habit_logs").upsert({ habit_id: h.id, day, done: next, pending_push: true, updated_at: new Date().toISOString() });
    if (error) { toast("ذخیره نشد؛ دوباره تلاش کنید"); load(); } else requestSync();
  }
  async function addHabit(v: { name: string; target: number | null; color: string }) {
    const { data, error } = await sb().from("habits").insert({ name: v.name, monthly_target: v.target, color: v.color, sort: habits.length }).select().single();
    if (error || !data) return toast("عادت اضافه نشد");
    if (v.target) await sb().from("habit_targets").upsert({ habit_id: data.id, jy, jm, target: v.target });
    await load(); requestSync(300);
  }
  async function updateHabit(id: string, patch: Partial<Habit>, target?: number | null) {
    await sb().from("habits").update(patch).eq("id", id);
    if (target) await sb().from("habit_targets").upsert({ habit_id: id, jy, jm, target });
    await load(); requestSync(300);
  }
  async function addGoal(scope: "week" | "month", slot: number, title: string) {
    const { error } = await sb().from("goals").insert({ scope, jy, jm, slot, title, pending_push: true });
    if (error) return toast("هدف اضافه نشد");
    await load(); requestSync(300);
  }
  async function toggleGoal(g: Goal) {
    setGoals((p) => p.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)));
    await sb().from("goals").update({ done: !g.done, pending_push: true }).eq("id", g.id); requestSync();
  }
  async function removeGoal(g: Goal) {
    setGoals((p) => p.filter((x) => x.id !== g.id));
    await sb().from("goals").update({ deleted: true, pending_push: true }).eq("id", g.id); requestSync(300);
  }
  return { habits, logs, goals, loading, targetOf, isDone, countOf, toggle, addHabit, updateHabit, addGoal, toggleGoal, removeGoal, reload: load, sync: () => requestSync(0) };
}

/* ---------- تودولیست ---------- */
export function useTodos(start: string, end: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await sb().from("todos").select("*").gte("day", start).lte("day", end).order("remind_time", { nullsFirst: false }).order("created_at");
    setTodos((data ?? []) as Todo[]); setLoading(false);
  }, [start, end]);
  useEffect(() => { load(); }, [load]);

  async function calendar(kind: "todo" | "habit", id: string, time: string | null) {
    const r = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, time }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast(j.error === "not_connected" ? "اول در تنظیمات به گوگل وصل شوید" : "ساخت یادآور در تقویم ناموفق بود"); return false; }
    return true;
  }
  async function add(day: string, title: string, time: string | null) {
    const { data, error } = await sb().from("todos").insert({ day, title }).select().single();
    if (error || !data) return toast("کار اضافه نشد");
    if (time) await calendar("todo", data.id, time);
    await load();
  }
  async function toggle(t: Todo) {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await sb().from("todos").update({ done: !t.done }).eq("id", t.id);
  }
  async function remove(t: Todo) {
    setTodos((p) => p.filter((x) => x.id !== t.id));
    if (t.event_id) await calendar("todo", t.id, null);
    await sb().from("todos").delete().eq("id", t.id);
  }
  async function setReminder(t: Todo, time: string | null) { if (await calendar("todo", t.id, time)) await load(); }
  return { todos, loading, add, toggle, remove, setReminder, reload: load, calendar };
}
export { toISO };
