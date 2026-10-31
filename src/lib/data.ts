"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sb, sessionUser } from "./supabase-browser";
import { addDays, monthLength, monthRange, prettyDate, toISO } from "./jalali";
import { dueCount, isDue, type Recurrence } from "./recurrence";
import type { Goal, Habit, Todo } from "./types";

export function toast(msg: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
}

/** تبدیل خطاهای فنی پایگاه داده به پیام قابل‌فهم برای کاربر */
export function friendlyDbError(msg?: string | null, fallback = "مشکلی پیش آمد؛ دوباره تلاش کنید"): string {
  const m = (msg || "").trim();
  if (!m) return fallback;
  // پیام‌هایی که از قبل فارسی هستند را بدون تغییر نشان بده
  if (/[\u0600-\u06FF]/.test(m)) return m;
  const low = m.toLowerCase();
  if (low.includes("failed to fetch") || low.includes("network") || low.includes("fetch failed")) {
    return "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید";
  }
  if (low.includes("jwt") || low.includes("not authenticated") || low.includes("unauthorized") || low.includes("invalid_token")) {
    return "نشست شما منقضی شده است؛ دوباره وارد حساب خود شوید";
  }
  if (low.includes("row-level security") || low.includes("permission denied")) {
    return "اجازهٔ انجام این کار را ندارید";
  }
  if (low.includes("duplicate") || low.includes("23505")) return "این مورد قبلاً ثبت شده است";
  if (low.includes("recurrence")) return "برای ذخیرهٔ تکرار، ابتدا کد SQL جدید را در Supabase اجرا کنید (ستون recurrence)";
  return fallback;
}

/** همهٔ تیک‌های انجام‌شده در یک بازه؛ صفحه‌به‌صفحه می‌خواند چون هر درخواست حداکثر ۱۰۰۰ ردیف برمی‌گرداند */
export async function fetchDoneLogs(start: string, end: string): Promise<{ habit_id: string; day: string }[]> {
  const out: { habit_id: string; day: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb()
      .from("habit_logs")
      .select("habit_id,day")
      .eq("done", true)
      .gte("day", start)
      .lte("day", end)
      .order("day")
      .order("habit_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as { habit_id: string; day: string }[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** چند روز قبل از ماه برای محاسبهٔ رکورد پیاپی خوانده می‌شود */
const HISTORY_DAYS = 400;

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

/* ---------- داده‌های یک ماه شمسی ---------- */
export function useMonth(jy: number, jm: number) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  /** تیک‌های انجام‌شدهٔ روزهای قبل از این ماه (فقط برای رکورد پیاپی) */
  const [past, setPast] = useState<Record<string, boolean>>({});
  const pastCache = useRef<{ key: string; data: Record<string, boolean> } | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const db = sb();
      const u = await sessionUser();
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
      setLoading(false);

      // سابقهٔ ماه‌های قبل برای رکورد پیاپی؛ بعد از نمایش ماه و بدون معطل کردن صفحه
      const pastKey = start;
      if (pastCache.current?.key === pastKey) {
        setPast(pastCache.current.data);
      } else {
        try {
          const rows = await fetchDoneLogs(addDays(start, -HISTORY_DAYS), addDays(start, -1));
          const map: Record<string, boolean> = {};
          rows.forEach((x) => { map[`${x.habit_id}|${x.day}`] = true; });
          pastCache.current = { key: pastKey, data: map };
          if (my === reqId.current) setPast(map);
        } catch (err) {
          console.error("Error loading habit history:", err);
        }
      }
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

  /** هدف ماه: برای عادت دارای تکرار = تعداد نوبت‌های همین ماه؛ برای عادت قدیمی = هدف دستی */
  const targetOf = (h: Habit) => (h.recurrence ? dueCount(h, jy, jm) : targets[h.id] ?? h.monthly_target ?? monthLength(jy, jm));
  /** آیا این عادت در این روز نوبت دارد؟ */
  const isDueOn = (h: Habit, day: string) => isDue(h, day);
  const monthStart = monthRange(jy, jm).start;
  // سابقهٔ قبلی فقط برای روزهای قبل از همین ماه معتبر است (جلوگیری از داده‌ی کهنه هنگام جابه‌جایی ماه)
  const isDone = (hid: string, day: string) => !!logs[`${hid}|${day}`] || (day < monthStart && !!past[`${hid}|${day}`]);
  /** تیک‌های این ماه؛ برای عادت دارای تکرار فقط روزهای نوبت شمرده می‌شوند تا از هدف بیشتر نشود */
  const countOf = (hid: string) => {
    const h = habits.find((x) => x.id === hid);
    const prefix = `${hid}|`;
    let c = 0;
    for (const k of Object.keys(logs)) if (k.startsWith(prefix) && (!h?.recurrence || isDue(h, k.slice(prefix.length)))) c++;
    return c;
  };
  /** عادت‌های فعالِ یک روز: آن‌هایی که نوبت دارند یا در آن روز تیک خورده‌اند */
  const habitsOn = (day: string) => habits.filter((h) => !h.archived && (isDue(h, day) || isDone(h.id, day)));

  async function toggle(h: Habit, day: string) {
    const key = `${h.id}|${day}`, next = !logs[key];
    setLogs((p) => {
      const n = { ...p };
      if (next) n[key] = true;
      else delete n[key];
      return n;
    });

    const u = await sessionUser();
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
      toast(friendlyDbError(error.message, "ذخیره انجام نشد؛ دوباره تلاش کنید"));
      load();
    }
  }

  async function addHabit(v: { name: string; color: string; recurrence: Recurrence; is_private?: boolean }) {
    const u = await sessionUser();
    if (!u?.user) {
      return toast("لطفاً ابتدا وارد حساب کاربری شوید");
    }

    const { data, error } = await sb().from("habits").insert({
      user_id: u.user.id,
      name: v.name,
      recurrence: v.recurrence,
      color: v.color,
      ...(v.is_private ? { is_private: true } : {}),
      sort: habits.length,
    }).select().single();

    if (error || !data) {
      return toast(friendlyDbError(error?.message, "عادت ذخیره نشد؛ دوباره تلاش کنید"));
    }

    toast("عادت جدید ثبت شد ✓");
    await load();
  }

  async function updateHabit(id: string, patch: Partial<Habit>) {
    const { error } = await sb().from("habits").update(patch).eq("id", id);
    if (error) {
      toast(friendlyDbError(error.message, "ویرایش انجام نشد؛ دوباره تلاش کنید"));
    }
    await load();
  }

  async function addGoal(scope: "week" | "month", slot: number, title: string) {
    const u = await sessionUser();
    if (!u?.user) return toast("لطفاً وارد حساب شوید");

    const { error } = await sb().from("goals").insert({
      user_id: u.user.id,
      scope,
      jy,
      jm,
      slot,
      title,
    });
    if (error) return toast(friendlyDbError(error.message, "هدف ذخیره نشد؛ دوباره تلاش کنید"));
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
    isDueOn,
    isDone,
    countOf,
    habitsOn,
    toggle,
    addHabit,
    updateHabit,
    addGoal,
    toggleGoal,
    removeGoal,
    reload: load,
  };
}

/* ---------- کارهای روزانه و رویدادهای تقویم ---------- */
/** روزی که کار/رویداد باید در آن دیده شود: تاریخ رویداد در تقویم، نه روز ساخته‌شدن */
export const todoDay = (t: Todo) => t.remind_date || t.day;

export function useTodos(start: string, end: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  // اگر ستون sort هنوز در پایگاه داده ساخته نشده باشد، بدون آن کار می‌کنیم
  const sortReady = useRef(true);

  const load = useCallback(async () => {
    try {
      const db = sb();
      const u = await sessionUser();
      if (!u?.user) {
        setTodos([]);
        setLoading(false);
        return;
      }

      // هم ردیف‌هایی که day در بازه است و هم آن‌هایی که تاریخ رویدادشان (remind_date) در بازه است
      const query = (withSort: boolean) => {
        let q = db
          .from("todos")
          .select("*")
          .or(`and(day.gte.${start},day.lte.${end}),and(remind_date.gte.${start},remind_date.lte.${end})`);
        if (withSort) q = q.order("sort");
        return q.order("remind_time", { nullsFirst: false }).order("created_at");
      };
      let { data, error } = await query(sortReady.current);
      if (error && sortReady.current) {
        sortReady.current = false;
        ({ data, error } = await query(false));
      }

      if (error) {
        console.error("Error fetching todos:", error);
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
          : j.error === "unauthorized"
            ? "نشست شما منقضی شده است؛ دوباره وارد حساب خود شوید"
            : friendlyDbError(j.error, "خطا در برقراری ارتباط با تقویم گوگل")
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
    const u = await sessionUser();
    if (!u?.user) {
      return toast("لطفاً ابتدا وارد حساب کاربری خود شوید");
    }

    const targetDate = date || day;
    // کار جدید ته لیست همان روز قرار می‌گیرد
    const nextSort = todos
      .filter((x) => todoDay(x) === (time ? targetDate : day))
      .reduce((m, x) => Math.max(m, (x.sort ?? 0) + 1), 0);
    const { data, error } = await sb()
      .from("todos")
      .insert({
        user_id: u.user.id,
        ...(sortReady.current ? { sort: nextSort } : {}),
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
      return toast(friendlyDbError(error?.message, "کار اضافه نشد؛ دوباره تلاش کنید"));
    }

    if (time) {
      const res = await calendar("todo", data.id, time, targetDate, type, durationMinutes, title);
      if (res && res.eventId) {
        await sb().from("todos").update({ event_id: res.eventId }).eq("id", data.id);
      }
    }
    toast(time && targetDate !== day ? `کار برای ${prettyDate(targetDate)} ثبت شد ✓` : "کار با موفقیت ثبت شد ✓");
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

  /** ذخیرهٔ ترتیب جدید کارهای یک روز (الویت‌بندی) */
  async function reorder(ordered: Todo[]) {
    const pos = new Map(ordered.map((x, i) => [x.id, i]));
    setTodos((p) =>
      p
        .map((x) => (pos.has(x.id) ? { ...x, sort: pos.get(x.id)! } : x))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    );
    const changed = ordered.filter((x, i) => (x.sort ?? 0) !== i);
    if (!changed.length) return;
    const results = await Promise.all(
      changed.map((x) => sb().from("todos").update({ sort: pos.get(x.id) }).eq("id", x.id))
    );
    if (results.some((r) => r.error)) {
      toast("ذخیرهٔ ترتیب کارها انجام نشد؛ دوباره تلاش کنید");
      load();
    }
  }

  async function update(t: Todo, patch: { title: string; date: string }) {
    const title = patch.title.trim();
    if (!title) return null;
    const date = patch.date || todoDay(t);
    const unchanged = title === t.title && date === todoDay(t);
    if (unchanged) return { ok: true };

    const fields: Record<string, unknown> = { title, day: date };

    if (t.remind_time) {
      // کار دارای رویداد تقویم است؛ رویداد را هم با عنوان و تاریخ جدید همگام می‌کنیم
      const res = await calendar(
        "todo",
        t.id,
        t.remind_time.slice(0, 5),
        date,
        t.event_type || "reminder",
        t.duration_minutes || 30,
        title,
        t.event_id
      );
      if (!res) return null;
      fields.day = res.date || date;
      fields.remind_date = res.date || date;
      if (res.eventId) fields.event_id = res.eventId;
    }

    const { error } = await sb().from("todos").update(fields).eq("id", t.id);
    if (error) {
      toast(friendlyDbError(error.message, "ویرایش انجام نشد؛ دوباره تلاش کنید"));
      return null;
    }
    toast("کار ویرایش شد ✓");
    await load();
    return { ok: true };
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

  return { todos, loading, add, toggle, remove, update, reorder, setReminder, reload: load, calendar };
}
export { toISO };
