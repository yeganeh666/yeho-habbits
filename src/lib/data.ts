"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "./supabase-browser";
import { monthLength, monthRange, prettyDate, toISO } from "./jalali";
import type { Goal, Habit, Todo } from "./types";

export function toast(msg: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
}

export function getLocalScriptUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const direct = localStorage.getItem("habitly_calendar_script_url") || localStorage.getItem("calendar_script_url");
    if (direct && direct.trim()) return direct.trim();
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
    try {
      const db = sb();
      const { data: u } = await db.auth.getUser();
      if (!u?.user) {
        setHabits([]);
        setLogs({});
        setTargets({});
        setGoals([]);
        setLoading(false);
        return;
      }

      const { start, end } = monthRange(jy, jm);
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
    } catch (err: any) {
      console.error("Error loading month data:", err);
    } finally {
      setLoading(false);
    }
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

    const { data: u } = await sb().auth.getUser();
    if (!u?.user) {
      toast("لطفاً ابتدا وارد حساب خود شوید");
      return;
    }

    const { error } = await sb().from("habit_logs").upsert({
      user_id: u.user.id,
      habit_id: h.id,
      day,
      done: next,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast(error.message || "ذخیره در Supabase انجام نشد؛ دوباره تلاش کنید");
      load();
    }
  }

  async function addHabit(v: { name: string; target: number | null; color: string; is_private?: boolean }) {
    const { data: u } = await sb().auth.getUser();
    if (!u?.user) {
      return toast("لطفاً ابتدا وارد حساب کاربری شوید");
    }

    const { data, error } = await sb().from("habits").insert({
      user_id: u.user.id,
      name: v.name,
      monthly_target: v.target,
      color: v.color,
      ...(v.is_private ? { is_private: true } : {}),
      sort: habits.length,
    }).select().single();

    if (error || !data) {
      return toast(error?.message || "عادت در پایگاه داده ذخیره نشد");
    }

    if (v.target) {
      await sb().from("habit_targets").upsert({ habit_id: data.id, jy, jm, target: v.target });
    }
    toast("عادت جدید در دیتابیس Supabase ثبت شد ✓");
    await load();
  }

  async function updateHabit(id: string, patch: Partial<Habit>, target?: number | null) {
    const { error } = await sb().from("habits").update(patch).eq("id", id);
    if (error) {
      toast(error.message || "ویرایش انجام نشد");
    }
    if (target) {
      await sb().from("habit_targets").upsert({ habit_id: id, jy, jm, target });
    }
    await load();
  }

  async function addGoal(scope: "week" | "month", slot: number, title: string) {
    const { data: u } = await sb().auth.getUser();
    if (!u?.user) return toast("لطفاً وارد حساب شوید");

    const { error } = await sb().from("goals").insert({
      user_id: u.user.id,
      scope,
      jy,
      jm,
      slot,
      title,
    });
    if (error) return toast(error.message || "هدف در دیتابیس ذخیره نشد");
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
/** روزی که کار/رویداد باید در آن دیده شود: تاریخ رویداد در تقویم، نه روز ساخته‌شدن */
export const todoDay = (t: Todo) => t.remind_date || t.day;

export function useTodos(start: string, end: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = sb();
      const { data: u } = await db.auth.getUser();
      if (!u?.user) {
        setTodos([]);
        setLoading(false);
        return;
      }

      // هم ردیف‌هایی که day در بازه است و هم آن‌هایی که تاریخ رویدادشان (remind_date) در بازه است
      const { data, error } = await db
        .from("todos")
        .select("*")
        .or(`and(day.gte.${start},day.lte.${end}),and(remind_date.gte.${start},remind_date.lte.${end})`)
        .order("remind_time", { nullsFirst: false })
        .order("created_at");

      if (error) {
        console.error("Error fetching todos from Supabase:", error);
      }
      // نمایش بر اساس تاریخ رویداد؛ کارِ بدون رویداد همان روز ساخته‌شدن را دارد
      setTodos(((data ?? []) as Todo[]).filter((x) => todoDay(x) >= start && todoDay(x) <= end));
    } catch (err: any) {
      console.error("Error loading todos:", err);
    } finally {
      setLoading(false);
    }
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
    const { data: u } = await sb().auth.getUser();
    if (!u?.user) {
      return toast("لطفاً ابتدا وارد حساب کاربری خود شوید");
    }

    const targetDate = date || day;
    const { data, error } = await sb()
      .from("todos")
      .insert({
        user_id: u.user.id,
        // اگر رویداد تقویم دارد، کار در همان تاریخ رویداد دیده می‌شود
        day: time ? targetDate : day,
        title,
        remind_time: time || null,
        remind_date: time ? targetDate : null,
        event_type: time ? type : null,
        duration_minutes: time ? durationMinutes : null,
      })
      .select()
      .single();

    if (error || !data) {
      return toast(error?.message || "کار در پایگاه داده اضافه نشد");
    }

    if (time) {
      const res = await calendar("todo", data.id, time, targetDate, type, durationMinutes, title);
      if (res && res.eventId) {
        await sb().from("todos").update({ event_id: res.eventId }).eq("id", data.id);
      }
    }
    toast(time && targetDate !== day ? `کار برای ${prettyDate(targetDate)} ثبت شد ✓` : "کار با موفقیت در Supabase ثبت شد ✓");
    await load();
  }

  async function toggle(t: Todo) {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    const { error } = await sb().from("todos").update({ done: !t.done }).eq("id", t.id);
    if (error) {
      toast("تغییر وضعیت ذخیره نشد");
      load();
    }
  }

  async function remove(t: Todo) {
    setTodos((p) => p.filter((x) => x.id !== t.id));
    if (t.event_id) await calendar("todo", t.id, null, null, undefined, undefined, t.title, t.event_id);
    const { error } = await sb().from("todos").delete().eq("id", t.id);
    if (error) {
      toast("حذف کار انجام نشد");
      load();
    }
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
          day: res.date || targetDate,
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
