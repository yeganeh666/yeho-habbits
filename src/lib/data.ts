"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase-browser";
import { monthLength, monthRange, toISO } from "./jalali";
import type { Goal, Habit, Todo } from "./types";

export function toast(msg: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
}

export function getLocalScriptUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const direct = localStorage.getItem("habitly_calendar_script_url") || localStorage.getItem("calendar_script_url");
    if (direct && direct.trim()) return direct.trim();
    const raw = localStorage.getItem("habitly_mock_user_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      if (first?.script_url && typeof first.script_url === "string") {
        return first.script_url.trim();
      }
    }
  } catch {}
  return "";
}

export function setLocalScriptUrl(url: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = (url || "").trim();
    if (clean) {
      localStorage.setItem("habitly_calendar_script_url", clean);
      localStorage.setItem("calendar_script_url", clean);
      document.cookie = `calendar_script_url=${encodeURIComponent(clean)}; path=/; max-age=31536000; SameSite=Lax`;
    } else {
      localStorage.removeItem("habitly_calendar_script_url");
      localStorage.removeItem("calendar_script_url");
      document.cookie = "calendar_script_url=; path=/; max-age=0; SameSite=Lax";
    }
  } catch {}
}

/* ---------- داده‌های یک ماه شمسی در Supabase ---------- */
export function useMonth(jy: number, jm: number) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

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
    (l.data ?? []).forEach((x: any) => {
      if (x.done) logMap[`${x.habit_id}|${x.day}`] = true;
    });

    const hs = ((h.data ?? []) as Habit[]).filter((x) => !x.archived || Object.keys(logMap).some((k) => k.startsWith(x.id)));
    setHabits(hs);
    setLogs(logMap);
    setTargets(Object.fromEntries((t.data ?? []).map((x: any) => [x.habit_id, x.target])));
    setGoals((g.data ?? []) as Goal[]);
    setLoading(false);
  }, [jy, jm]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const targetOf = (h: Habit) => targets[h.id] ?? h.monthly_target ?? monthLength(jy, jm);
  const isDone = (hid: string, day: string) => !!logs[`${hid}|${day}`];
  const countOf = (hid: string) => Object.keys(logs).filter((k) => k.startsWith(hid)).length;

  async function toggle(h: Habit, day: string) {
    const key = `${h.id}|${day}`, next = !logs[key];
    setLogs((p) => {
      const n = { ...p };
      if (next) n[key] = true;
      else delete n[key];
      return n;
    });
    const { error } = await sb().from("habit_logs").upsert({
      habit_id: h.id,
      day,
      done: next,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast("ذخیره نشد؛ لطفاً دوباره تلاش کنید");
      load();
    }
  }

  async function addHabit(v: { name: string; target: number | null; color: string }) {
    const { data, error } = await sb().from("habits").insert({
      name: v.name,
      monthly_target: v.target,
      color: v.color,
      sort: habits.length,
    }).select().single();

    if (error || !data) return toast("عادت اضافه نشد");
    if (v.target) {
      await sb().from("habit_targets").upsert({ habit_id: data.id, jy, jm, target: v.target });
    }
    await load();
  }

  async function updateHabit(id: string, patch: Partial<Habit>, target?: number | null) {
    await sb().from("habits").update(patch).eq("id", id);
    if (target) {
      await sb().from("habit_targets").upsert({ habit_id: id, jy, jm, target });
    }
    await load();
  }

  async function addGoal(scope: "week" | "month", slot: number, title: string) {
    const { error } = await sb().from("goals").insert({
      scope,
      jy,
      jm,
      slot,
      title,
    });
    if (error) return toast("هدف اضافه نشد");
    await load();
  }

  async function toggleGoal(g: Goal) {
    setGoals((p) => p.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)));
    await sb().from("goals").update({ done: !g.done }).eq("id", g.id);
  }

  async function removeGoal(g: Goal) {
    setGoals((p) => p.filter((x) => x.id !== g.id));
    await sb().from("goals").update({ deleted: true }).eq("id", g.id);
  }

  return {
    habits,
    logs,
    goals,
    loading,
    targetOf,
    isDone,
    countOf,
    toggle,
    addHabit,
    updateHabit,
    addGoal,
    toggleGoal,
    removeGoal,
    reload: load,
  };
}

/* ---------- کارهای روزانه و رویدادهای تقویم در Supabase ---------- */
export function useTodos(start: string, end: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await sb()
      .from("todos")
      .select("*")
      .gte("day", start)
      .lte("day", end)
      .order("remind_time", { nullsFirst: false })
      .order("created_at");
    setTodos((data ?? []) as Todo[]);
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  async function calendar(
    kind: "todo" | "habit",
    id: string,
    time: string | null,
    date?: string | null,
    type?: "reminder" | "meeting",
    durationMinutes?: number,
    title?: string,
    eventId?: string | null
  ) {
    const scriptUrl = getLocalScriptUrl();
    const r = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        id,
        title,
        eventId,
        time,
        date,
        type,
        durationMinutes,
        scriptUrl,
      }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(
        j.error === "not_connected"
          ? j.message || "اول در تنظیمات تقویم گوگل را متصل کنید"
          : j.error || "خطا در برقراری ارتباط با تقویم گوگل"
      );
      return null;
    }

    if (!time) {
      toast("رویداد از تقویم حذف شد");
    } else if (j.notConnected) {
      toast(type === "meeting" ? "جلسه ثبت شد (آماده برای تقویم گوگل)" : "یادآور ثبت شد (آماده برای تقویم گوگل)");
      if (j.calendarUrl && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("calendar_link_ready", { detail: j }));
      }
    } else {
      toast(type === "meeting" ? "جلسه در تقویم گوگل ثبت شد ✓" : "یادآور در تقویم گوگل ثبت شد ✓");
    }
    return j;
  }

  async function add(
    day: string,
    title: string,
    time: string | null,
    date?: string | null,
    type: "reminder" | "meeting" = "reminder",
    durationMinutes = 30
  ) {
    const targetDate = date || day;
    const { data, error } = await sb()
      .from("todos")
      .insert({
        day,
        title,
        remind_time: time || null,
        remind_date: time ? targetDate : null,
        event_type: time ? type : null,
        duration_minutes: time ? durationMinutes : null,
      })
      .select()
      .single();

    if (error || !data) return toast("کار اضافه نشد");
    if (time) {
      const res = await calendar("todo", data.id, time, targetDate, type, durationMinutes, title);
      if (res && res.eventId) {
        await sb().from("todos").update({ event_id: res.eventId }).eq("id", data.id);
      }
    }
    await load();
  }

  async function toggle(t: Todo) {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await sb().from("todos").update({ done: !t.done }).eq("id", t.id);
  }

  async function remove(t: Todo) {
    setTodos((p) => p.filter((x) => x.id !== t.id));
    if (t.event_id) await calendar("todo", t.id, null, null, undefined, undefined, t.title, t.event_id);
    await sb().from("todos").delete().eq("id", t.id);
  }

  async function setReminder(
    t: Todo,
    time: string | null,
    date?: string | null,
    type: "reminder" | "meeting" = "reminder",
    durationMinutes = 30
  ) {
    const targetDate = date || t.remind_date || t.day;
    if (time) {
      const res = await calendar("todo", t.id, time, targetDate, type, durationMinutes, t.title, t.event_id);
      if (res && res.ok) {
        await sb().from("todos").update({
          remind_time: time,
          remind_date: res.date || targetDate,
          event_type: type,
          duration_minutes: durationMinutes,
          event_id: res.eventId || t.event_id,
        }).eq("id", t.id);
        await load();
        return res;
      }
    } else {
      await calendar("todo", t.id, null, null, undefined, undefined, t.title, t.event_id);
      await sb().from("todos").update({
        remind_time: null,
        remind_date: null,
        event_type: null,
        duration_minutes: null,
        event_id: null,
      }).eq("id", t.id);
      await load();
      return { ok: true };
    }
    return null;
  }

  return { todos, loading, add, toggle, remove, setReminder, reload: load, calendar };
}
export { toISO };
