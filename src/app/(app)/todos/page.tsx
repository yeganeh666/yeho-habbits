"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addDays, fa, fromISO, MONTHS, prettyDate, todayISO, WEEKDAYS_SHORT, weekStartISO } from "@/lib/jalali";
import { todoDay, useTodos } from "@/lib/data";
import { btnGhost, btnPrimary, CalendarBadge, Check, Donut, Field, inputCls, pctText, Sheet } from "@/components/ui";
import { JalaliCalendarModal } from "@/components/calendar-picker";
import type { Todo } from "@/lib/types";

export default function Todos() {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const anchor = weekStartISO(day);
  const t = useTodos(addDays(anchor, -35), addDays(anchor, 13));

  // فرم افزودن کار جدید
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [addDate, setAddDate] = useState(today);
  const [addType, setAddType] = useState<"reminder" | "meeting">("reminder");
  const [addDuration, setAddDuration] = useState(30);

  // وضعیت مودال تقویم گوگل
  const [rem, setRem] = useState<Todo | null>(null);
  const [remTime, setRemTime] = useState("");
  const [remDate, setRemDate] = useState(today);
  const [remType, setRemType] = useState<"reminder" | "meeting">("reminder");
  const [remDuration, setRemDuration] = useState(30);

  // ویرایش عنوان و تاریخ کار
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState(today);
  const [editBusy, setEditBusy] = useState(false);

  // وضعیت باز بودن تقویم ماهانه
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"quick_add" | "reminder_modal" | "edit">("reminder_modal");
  const [directCalendarUrl, setDirectCalendarUrl] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m: Record<string, Todo[]> = {};
    t.todos.forEach((x) => (m[todoDay(x)] ??= []).push(x));
    return m;
  }, [t.todos]);

  // ---------- جابجایی کارها با نگه داشتن (الویت‌بندی) ----------
  const [order, setOrder] = useState<string[] | null>(null); // ترتیب موقت هنگام کشیدن
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{
    id: string; startX: number; startY: number; lastY: number; grab: number;
    active: boolean; timer: ReturnType<typeof setTimeout> | null; scroller: ReturnType<typeof setInterval> | null;
    cleanup: () => void;
  } | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const dayListRef = useRef<Todo[]>([]);

  const baseList = byDay[day] ?? [];
  dayListRef.current = baseList;
  const list = order
    ? order.map((id) => baseList.find((x) => x.id === id)).filter((x): x is Todo => !!x)
    : baseList;

  const dragEl = () => listRef.current?.querySelector<HTMLElement>(`[data-todo-id="${drag.current?.id}"]`) ?? null;

  function applyDragTransform() {
    const d = drag.current, el = dragEl();
    if (!d || !d.active || !el) return;
    el.style.transform = "";
    const natural = el.getBoundingClientRect().top;
    el.style.transform = `translateY(${d.lastY - d.grab - natural}px) scale(1.03)`;
  }

  function checkSwap() {
    const d = drag.current, ids = orderRef.current;
    if (!d || !ids || !listRef.current) return;
    const el = dragEl();
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    const center = d.lastY - d.grab + h / 2;
    const others = ids.filter((id) => id !== d.id);
    let idx = 0;
    others.forEach((id) => {
      const o = listRef.current!.querySelector<HTMLElement>(`[data-todo-id="${id}"]`);
      if (!o) return;
      const r = o.getBoundingClientRect();
      if (r.top + r.height / 2 < center) idx++;
    });
    if (ids.indexOf(d.id) !== idx) {
      const next = [...others];
      next.splice(idx, 0, d.id);
      orderRef.current = next;
      setOrder(next);
    }
  }

  // بعد از هر تغییر ترتیب، کارتِ در حال کشیدن را دوباره زیر انگشت قرار بده
  useLayoutEffect(() => { applyDragTransform(); }, [order]);

  // جلوگیری از اسکرول صفحه وقتی کارتی در حال جابجایی است
  useEffect(() => {
    const block = (e: TouchEvent) => { if (drag.current?.active && e.cancelable) e.preventDefault(); };
    window.addEventListener("touchmove", block, { passive: false });
    return () => window.removeEventListener("touchmove", block);
  }, []);

  function startPress(e: React.PointerEvent<HTMLLIElement>, id: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    if (drag.current) drag.current.cleanup();
    const li = e.currentTarget;

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      d.lastY = ev.clientY;
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > 8) d.cleanup();
        return;
      }
      checkSwap();
      applyDragTransform();
    };
    const finish = () => {
      const d = drag.current;
      if (!d) return;
      const wasActive = d.active;
      const ids = orderRef.current;
      d.cleanup();
      if (wasActive && ids) {
        const byId = new Map(dayListRef.current.map((x) => [x.id, x]));
        const ordered = ids.map((i) => byId.get(i)).filter((x): x is Todo => !!x);
        if (ordered.some((x, i) => x.id !== dayListRef.current[i]?.id)) t.reorder(ordered);
      }
    };
    const cleanup = () => {
      const d = drag.current;
      if (d?.timer) clearTimeout(d.timer);
      if (d?.scroller) clearInterval(d.scroller);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const el = listRef.current?.querySelector<HTMLElement>(`[data-todo-id="${id}"]`);
      if (el) el.style.transform = "";
      drag.current = null;
      orderRef.current = null;
      setOrder(null);
      setDragId(null);
    };

    drag.current = {
      id, startX: e.clientX, startY: e.clientY, lastY: e.clientY, grab: 0,
      active: false, timer: null, scroller: null, cleanup,
    };
    drag.current.timer = setTimeout(() => {
      const d = drag.current;
      if (!d) return;
      d.active = true;
      d.grab = d.startY - li.getBoundingClientRect().top;
      orderRef.current = dayListRef.current.map((x) => x.id);
      setOrder(orderRef.current);
      setDragId(id);
      navigator.vibrate?.(15);
      // اسکرول خودکار کنار لبه‌های صفحه
      d.scroller = setInterval(() => {
        const dd = drag.current;
        if (!dd) return;
        const edge = 90;
        if (dd.lastY < edge) window.scrollBy(0, -12);
        else if (dd.lastY > window.innerHeight - edge) window.scrollBy(0, 12);
        else return;
        checkSwap();
        applyDragTransform();
      }, 16);
    }, 350);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  // پاکسازی در صورت خروج از صفحه
  useEffect(() => () => { drag.current?.cleanup(); }, []);
  const done = list.filter((x) => x.done).length;
  const pct = (iso: string) => {
    const l = byDay[iso] ?? [];
    return l.length ? l.filter((x) => x.done).length / l.length : null;
  };
  const week = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));

  // آمار ۱۴ روز تا روز انتخابی (یا امروز) و ۳۰ روز اخیر
  const end = day > today ? today : day;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(end, i - 13));
  const last30 = t.todos.filter((x) => todoDay(x) <= end && todoDay(x) > addDays(end, -30));
  const rate30 = last30.length ? last30.filter((x) => x.done).length / last30.length : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = title.trim();
    if (!v) return;
    setTitle("");
    const tm = time;
    const dt = time ? (addDate || day) : null;
    const tp = addType;
    const dur = addDuration;
    setTime("");
    await t.add(day, v, tm || null, dt, tp, dur);
  }

  function openReminderModal(todo: Todo) {
    setRem(todo);
    setDirectCalendarUrl(null);
    setRemTime(todo.remind_time?.slice(0, 5) ?? "09:00");
    setRemDate(todo.remind_date || todo.day || day);
    setRemType(todo.event_type || "reminder");
    setRemDuration(todo.duration_minutes || 30);
  }

  function openEditModal(todo: Todo) {
    setEditing(todo);
    setEditTitle(todo.title);
    setEditDate(todoDay(todo));
  }

  async function saveEdit() {
    if (!editing || !editTitle.trim()) return;
    setEditBusy(true);
    const res = await t.update(editing, { title: editTitle, date: editDate });
    setEditBusy(false);
    if (res) setEditing(null);
  }

  const openCalendarFor = (target: "quick_add" | "reminder_modal" | "edit") => {
    setCalendarTarget(target);
    setCalendarOpen(true);
  };

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">کارها و رویدادها</h1>
          <p className="text-sm text-mute">{prettyDate(day)}</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarBadge />
          <Link
            href="/settings"
            aria-label="تنظیمات"
            className="grid h-8 w-8 place-items-center rounded-full bg-surface shadow-card text-mute hover:text-ink active:scale-95 transition-transform text-sm"
          >
            ⚙️
          </Link>
        </div>
      </header>

      {/* انتخاب هفته به‌صورت لمسی و موبایل‌فرست */}
      <div className="mb-5 flex items-center gap-1.5">
        <button
          aria-label="هفته قبل"
          className="grid h-11 w-9 shrink-0 place-items-center rounded-xl bg-surface text-xl font-bold text-mute shadow-card active:scale-95 transition-transform"
          onClick={() => setDay(addDays(day, -7))}
        >
          ›
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {week.map((iso, i) => {
            const on = iso === day, p = pct(iso), q = fromISO(iso);
            return (
              <button
                key={iso}
                onClick={() => { setDay(iso); setAddDate(iso); }}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 active:scale-95 transition-all ${
                  on ? "bg-brand text-white shadow-card scale-102" : "bg-surface"
                }`}
              >
                <span className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-mute"}`}>
                  {WEEKDAYS_SHORT[i]}
                </span>
                <span className="text-sm font-extrabold">{fa(q.jd)}</span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: p === null ? "transparent" : p === 1 ? "rgb(var(--mint))" : on ? "#fff" : "rgb(var(--amber))",
                  }}
                />
              </button>
            );
          })}
        </div>
        <button
          aria-label="هفته بعد"
          className="grid h-11 w-9 shrink-0 place-items-center rounded-xl bg-surface text-xl font-bold text-mute shadow-card active:scale-95 transition-transform"
          onClick={() => setDay(addDays(day, 7))}
        >
          ‹
        </button>
      </div>

      {day !== today && (
        <button
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          onClick={() => { setDay(today); setAddDate(today); }}
        >
          <span>↺</span> بازگشت به امروز ({prettyDate(today).split(" ")[0]})
        </button>
      )}

      {/* فرم افزودن کار، یادآور یا جلسه */}
      <form onSubmit={add} className="mb-5 rounded-hero bg-surface p-4 shadow-card">
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="کار، یادآور یا جلسه جدید…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="عنوان کار"
          />
          <button className={`${btnPrimary} px-5`} disabled={!title.trim()}>
            افزودن
          </button>
        </div>

        <div className="mt-3 border-t border-line/60 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-mute">
            <span className="text-ink">تقویم گوگل:</span>
            <button
              type="button"
              onClick={() => {
                if (!time) setTime("10:00");
                setAddType("reminder");
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                time && addType === "reminder" ? "bg-mint text-white shadow-card" : "bg-soft text-ink"
              }`}
            >
              🔔 یادآور
            </button>
            <button
              type="button"
              onClick={() => {
                if (!time) setTime("10:00");
                setAddType("meeting");
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                time && addType === "meeting" ? "bg-brand text-white shadow-card" : "bg-soft text-ink"
              }`}
            >
              📅 جلسه
            </button>

            {time && (
              <div className="flex flex-wrap items-center gap-2 mt-2 w-full">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-xl border border-line bg-bg px-2.5 py-1.5 text-ink text-sm outline-none focus:border-brand"
                  aria-label="ساعت رویداد"
                />

                {addType === "meeting" && (
                  <select
                    value={addDuration}
                    onChange={(e) => setAddDuration(Number(e.target.value))}
                    className="rounded-xl border border-line bg-bg px-2.5 py-1.5 text-xs text-ink outline-none"
                  >
                    <option value={15}>۱۵ دقیقه</option>
                    <option value={30}>۳۰ دقیقه</option>
                    <option value={45}>۴۵ دقیقه</option>
                    <option value={60}>۱ ساعت</option>
                    <option value={90}>۱.۵ ساعت</option>
                  </select>
                )}

                {/* دکمه باز کردن تقویم برای تاریخ */}
                <button
                  type="button"
                  onClick={() => openCalendarFor("quick_add")}
                  className="flex items-center gap-1 rounded-xl bg-brand/10 border border-brand/20 px-3 py-1.5 text-xs font-extrabold text-brand active:scale-95 transition-transform"
                >
                  <span>📅</span>
                  <span>{prettyDate(addDate || day)}</span>
                </button>

                <button
                  type="button"
                  className="text-xs text-[#E5484D] ms-auto"
                  onClick={() => setTime("")}
                >
                  حذف تقویم
                </button>
              </div>
            )}
          </div>

          {time && (
            <p className="mt-2 text-xs font-semibold text-mint">
              {addType === "meeting" ? "📅 جلسه" : "🔔 یادآور"} در تاریخ {prettyDate(addDate || day)}، ساعت {fa(time)} در تقویم ثبت خواهد شد.
            </p>
          )}
        </div>
      </form>

      {/* لیست کارهای روز */}
      <section aria-label="کارهای این روز">
        {t.loading ? (
          <p className="py-8 text-center text-mute">در حال بارگذاری…</p>
        ) : list.length === 0 ? (
          <p className="rounded-hero border-2 border-dashed border-line p-8 text-center text-mute text-sm">
            برای این روز کاری ثبت نشده است. در کادر بالا اولین کار را اضافه کنید.
          </p>
        ) : (
          <>
          <ul ref={listRef} className="space-y-2.5">
            {list.map((x) => {
              const hasDiffDate = x.remind_date && x.remind_date !== x.day;
              const isMeeting = x.event_type === "meeting";
              return (
                <li
                  key={x.id}
                  data-todo-id={x.id}
                  onPointerDown={(e) => startPress(e, x.id)}
                  onContextMenu={(e) => { if (drag.current) e.preventDefault(); }}
                  style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties}
                  className={`relative flex items-center gap-3 rounded-hero bg-surface p-3.5 ${
                    dragId === x.id
                      ? "z-20 shadow-2xl ring-2 ring-brand/40 transition-none cursor-grabbing"
                      : "shadow-card active:scale-[0.99] transition-transform"
                  }`}
                >
                  <Check
                    on={x.done}
                    size={34}
                    color={isMeeting ? "rgb(var(--brand))" : "rgb(var(--mint))"}
                    label={x.title}
                    onClick={() => t.toggle(x)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate font-bold text-sm ${x.done ? "text-mute line-through" : "text-ink"}`}>
                      {x.title}
                    </p>
                    {x.remind_time && (
                      <p className="mt-0.5 text-xs text-mute flex items-center gap-1">
                        <span>{isMeeting ? "📅 جلسه" : "🔔 یادآور"}:</span>
                        <span>{prettyDate(x.remind_date || x.day)} ساعت {fa(x.remind_time.slice(0, 5))}</span>
                        {isMeeting && x.duration_minutes && <span>({fa(x.duration_minutes)} د)</span>}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openReminderModal(x)}
                    aria-label="تنظیم یادآور یا جلسه در تقویم گوگل"
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold active:scale-95 transition-all ${
                      x.event_id
                        ? isMeeting
                          ? "bg-brand/15 text-brand"
                          : "bg-mint/15 text-mint"
                        : "bg-soft text-mute hover:text-ink"
                    }`}
                  >
                    <span>{isMeeting ? "📅" : "🔔"}</span>
                    {x.remind_time ? (
                      <span>
                        {hasDiffDate && <span className="opacity-80">{fa(fromISO(x.remind_date!).jd)} {MONTHS[fromISO(x.remind_date!).jm - 1]} · </span>}
                        {fa(x.remind_time.slice(0, 5))}
                      </span>
                    ) : (
                      "تقویم"
                    )}
                  </button>
                  <button aria-label={`ویرایش ${x.title}`} className="px-1.5 py-1 text-mute opacity-60 hover:opacity-100 active:scale-90" onClick={() => openEditModal(x)}>✎</button>
                  <button aria-label={`حذف ${x.title}`} className="px-2 py-1 text-mute opacity-60 hover:opacity-100 active:scale-90" onClick={() => t.remove(x)}>✕</button>
                </li>
              );
            })}
          </ul>
          {list.length > 1 && (
            <p className="mt-3 text-center text-[11px] text-mute">
              برای تغییر الویت، روی یک کار نگه دارید و آن را بکشید.
            </p>
          )}
          </>
        )}
      </section>

      {/* آمار موفقیت */}
      <section className="mt-8 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-base font-extrabold">آمار کارهای روزانه</h2>
        <div className="flex items-center gap-5">
          <Donut pct={list.length ? done / list.length : 0} color="rgb(var(--mint))"><div className="text-lg font-extrabold">{pctText(list.length ? done / list.length : 0)}</div></Donut>
          <div className="space-y-1 text-sm">
            <p><span className="font-extrabold">{fa(done)}</span> از <span className="font-extrabold">{fa(list.length)}</span> کار این روز انجام شد</p>
            <p className="text-mute">۳۰ روز اخیر: {pctText(rate30)} موفقیت ({fa(last30.filter((x) => x.done).length)} از {fa(last30.length)})</p>
          </div>
        </div>
        <div className="mt-5 flex h-24 items-end gap-1" role="img" aria-label="درصد موفقیت ۱۴ روز اخیر">
          {last14.map((iso) => {
            const p = pct(iso);
            return (
              <div key={iso} className="flex flex-1 flex-col items-center gap-1" title={`${fa(fromISO(iso).jd)} ${MONTHS[fromISO(iso).jm - 1]}: ${p === null ? "بدون کار" : pctText(p)}`}>
                <div className="flex w-full flex-1 items-end overflow-hidden rounded-md bg-soft"><div className="w-full rounded-md bg-mint transition-[height]" style={{ height: `${(p ?? 0) * 100}%` }} /></div>
                <span className={`text-[10px] font-semibold ${iso === day ? "text-brand" : "text-mute"}`}>{fa(fromISO(iso).jd)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ویرایش عنوان و تاریخ کار */}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="ویرایش کار">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
        >
          <Field label="عنوان">
            <input
              className={inputCls}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              aria-label="عنوان کار"
              autoFocus
            />
          </Field>
          <div>
            <span className="block text-xs font-bold text-mute mb-2">تاریخ:</span>
            <button
              type="button"
              onClick={() => openCalendarFor("edit")}
              className="flex w-full items-center justify-between rounded-xl bg-surface p-3 text-sm font-extrabold text-brand shadow-sm border border-brand/20 active:scale-98 transition-all"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span>{prettyDate(editDate)}</span>
              </span>
              <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs text-brand">تغییر تاریخ ▾</span>
            </button>
            {editing?.remind_time && (
              <p className="mt-2 text-[11px] text-mute">
                این کار در تقویم گوگل هم ثبت شده است؛ عنوان و تاریخ رویداد هم به‌روز می‌شود.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button className={`${btnPrimary} flex-1 py-3.5`} disabled={!editTitle.trim() || editBusy}>
              {editBusy ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </button>
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>انصراف</button>
          </div>
        </form>
      </Sheet>

      {/* مدال تنظیم تاریخ، ساعت، یادآور یا جلسه در تقویم گوگل */}
      <Sheet open={!!rem} onClose={() => setRem(null)} title="ثبت در تقویم گوگل">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-mute">
            عنوان: <span className="font-bold text-ink">«{rem?.title}»</span>
          </p>

          {/* نوع رویداد: یادآور یا جلسه */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRemType("reminder")}
              className={`flex-1 rounded-2xl py-3 text-center text-sm font-bold transition-all active:scale-95 ${
                remType === "reminder" ? "bg-mint text-white shadow-card" : "bg-soft text-ink"
              }`}
            >
              🔔 یادآور با اعلان
            </button>
            <button
              type="button"
              onClick={() => setRemType("meeting")}
              className={`flex-1 rounded-2xl py-3 text-center text-sm font-bold transition-all active:scale-95 ${
                remType === "meeting" ? "bg-brand text-white shadow-card" : "bg-soft text-ink"
              }`}
            >
              📅 جلسه / رویداد
            </button>
          </div>

          {/* بخش انتخاب تاریخ با باز شدن تقویم جلالی */}
          <div className="rounded-2xl bg-soft/50 p-4 border border-line/60">
            <span className="block text-xs font-bold text-mute mb-2">تاریخ رویداد:</span>

            {/* دکمه اصلی باز کردن تقویم ماهانه */}
            <button
              type="button"
              onClick={() => openCalendarFor("reminder_modal")}
              className="flex w-full items-center justify-between rounded-xl bg-surface p-3 text-sm font-extrabold text-brand shadow-sm border border-brand/20 active:scale-98 transition-all"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span>{prettyDate(remDate)}</span>
              </span>
              <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs text-brand">
                باز کردن تقویم ▾
              </span>
            </button>

            {/* میانبرهای سریع تاریخ */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rem?.day && (
                <button
                  type="button"
                  onClick={() => setRemDate(rem.day)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-colors ${remDate === rem.day ? "bg-brand text-white shadow-card" : "bg-surface text-ink hover:bg-surface/80"}`}
                >
                  روز همین کار ({fa(fromISO(rem.day).jd)} {MONTHS[fromISO(rem.day).jm - 1]})
                </button>
              )}
              <button
                type="button"
                onClick={() => setRemDate(today)}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-colors ${remDate === today ? "bg-brand text-white shadow-card" : "bg-surface text-ink hover:bg-surface/80"}`}
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => setRemDate(addDays(today, 1))}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-colors ${remDate === addDays(today, 1) ? "bg-brand text-white shadow-card" : "bg-surface text-ink hover:bg-surface/80"}`}
              >
                فردا
              </button>
            </div>
          </div>

          {/* ساعت و مدت زمان */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ساعت شروع">
              <input
                type="time"
                className={inputCls}
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                required
              />
            </Field>

            {remType === "meeting" ? (
              <Field label="مدت زمان جلسه">
                <select
                  className={inputCls}
                  value={remDuration}
                  onChange={(e) => setRemDuration(Number(e.target.value))}
                >
                  <option value={15}>۱۵ دقیقه</option>
                  <option value={30}>۳۰ دقیقه</option>
                  <option value={45}>۴۵ دقیقه</option>
                  <option value={60}>۱ ساعت</option>
                  <option value={90}>۱.۵ ساعت</option>
                  <option value={120}>۲ ساعت</option>
                </select>
              </Field>
            ) : (
              <div className="flex flex-col justify-center">
                <span className="text-xs font-bold text-mint">اعلان خودکار</span>
                <p className="text-[11px] text-mute mt-1">پاپ‌آپ اعلان دقیقاً در همان ساعت در تقویم ظاهر خواهد شد.</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              className={`${btnPrimary} flex-1 py-3.5`}
              disabled={!remTime || !remDate}
              onClick={async () => {
                if (rem) {
                  const res = await t.setReminder(rem, remTime, remDate, remType, remDuration);
                  if (res?.calendarUrl && res?.notConnected) {
                    setDirectCalendarUrl(res.calendarUrl);
                  } else {
                    setRem(null);
                  }
                }
              }}
            >
              {remType === "meeting" ? "ثبت جلسه در تقویم گوگل" : "ثبت یادآور در تقویم گوگل"}
            </button>
            {rem?.event_id && (
              <button
                className={btnGhost}
                onClick={async () => {
                  if (rem) await t.setReminder(rem, null);
                  setRem(null);
                }}
              >
                حذف از تقویم
              </button>
            )}
          </div>

          {directCalendarUrl && (
            <div className="mt-3 rounded-2xl bg-mint/10 border border-mint/30 p-4 text-center space-y-2.5">
              <p className="text-sm font-bold text-mint">
                ✓ با موفقیت ذخیره شد!
              </p>
              <p className="text-xs text-mute leading-5">
                برای ثبت مستقیم در تقویم گوگل گوشی یا مرورگر خود، روی دکمهٔ زیر بزنید:
              </p>
              <a
                href={directCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setDirectCalendarUrl(null);
                  setRem(null);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-card active:scale-95 transition-transform"
              >
                <span>📅</span>
                <span>باز کردن مستقیم در تقویم گوگل</span>
              </a>
              <button
                type="button"
                className="text-xs text-mute underline hover:text-ink block mx-auto pt-1"
                onClick={() => {
                  setDirectCalendarUrl(null);
                  setRem(null);
                }}
              >
                بستن پنجره
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* تقویم گرافیکی ماهانه برای انتخاب روز */}
      <JalaliCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={calendarTarget === "quick_add" ? addDate : calendarTarget === "edit" ? editDate : remDate}
        onChange={(newIso) => {
          if (calendarTarget === "quick_add") {
            setAddDate(newIso);
          } else if (calendarTarget === "edit") {
            setEditDate(newIso);
          } else {
            setRemDate(newIso);
          }
        }}
        title="انتخاب تاریخ در تقویم شمسی"
      />
    </main>
  );
}
