"use client";
import { useMemo, useState } from "react";
import { addDays, fa, fromISO, MONTHS, prettyDate, todayISO, WEEKDAYS_SHORT, weekStartISO } from "@/lib/jalali";
import { useTodos } from "@/lib/data";
import { btnGhost, btnPrimary, Check, Donut, Field, inputCls, pctText, Sheet } from "@/components/ui";
import type { Todo } from "@/lib/types";

export default function Todos() {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const anchor = weekStartISO(day);
  const t = useTodos(addDays(anchor, -35), addDays(anchor, 13));
  const [title, setTitle] = useState(""); const [time, setTime] = useState("");
  const [rem, setRem] = useState<Todo | null>(null); const [remTime, setRemTime] = useState("");

  const byDay = useMemo(() => { const m: Record<string, Todo[]> = {}; t.todos.forEach((x) => (m[x.day] ??= []).push(x)); return m; }, [t.todos]);
  const list = byDay[day] ?? [];
  const done = list.filter((x) => x.done).length;
  const pct = (iso: string) => { const l = byDay[iso] ?? []; return l.length ? l.filter((x) => x.done).length / l.length : null; };
  const week = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));

  // آمار ۱۴ روز تا روز انتخابی (یا امروز) و ۳۰ روز اخیر
  const end = day > today ? today : day;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(end, i - 13));
  const last30 = t.todos.filter((x) => x.day <= end && x.day > addDays(end, -30));
  const rate30 = last30.length ? last30.filter((x) => x.done).length / last30.length : 0;

  async function add(e: React.FormEvent) { e.preventDefault(); const v = title.trim(); if (!v) return; setTitle(""); const tm = time; setTime(""); await t.add(day, v, tm || null); }
  const j = fromISO(day);

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-4"><h1 className="text-2xl font-extrabold">کارهای روزانه</h1><p className="text-sm text-mute">{prettyDate(day)}</p></header>

      <div className="mb-5 flex items-center gap-2">
        <button aria-label="هفته بعد" className="grid h-10 w-8 shrink-0 place-items-center text-xl text-mute" onClick={() => setDay(addDays(day, 7))}>‹</button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {week.map((iso, i) => {
            const on = iso === day, p = pct(iso), q = fromISO(iso);
            return (
              <button key={iso} onClick={() => setDay(iso)} aria-pressed={on} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${on ? "bg-brand text-white shadow-card" : "bg-surface"}`}>
                <span className={`text-xs font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[i]}</span>
                <span className="font-extrabold">{fa(q.jd)}</span>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p === null ? "transparent" : p === 1 ? "rgb(var(--mint))" : on ? "#fff" : "rgb(var(--amber))" }} />
              </button>
            );
          })}
        </div>
        <button aria-label="هفته قبل" className="grid h-10 w-8 shrink-0 place-items-center text-xl text-mute" onClick={() => setDay(addDays(day, -7))}>›</button>
      </div>
      {day !== today && <button className="mb-4 text-sm font-bold text-brand" onClick={() => setDay(today)}>برگرد به امروز</button>}

      <form onSubmit={add} className="mb-5 rounded-row bg-surface p-3 shadow-card">
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} placeholder="کار جدید…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="عنوان کار" />
          <button className={btnPrimary} disabled={!title.trim()}>افزودن</button>
        </div>
        <label className="mt-2.5 flex items-center gap-3 text-sm font-semibold text-mute">
          <span>یادآور در تقویم گوگل</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-line bg-bg px-3 py-1.5 text-ink" aria-label="ساعت یادآور" />
          {time && <button type="button" className="text-brand" onClick={() => setTime("")}>بدون یادآور</button>}
        </label>
      </form>

      <section aria-label="کارهای این روز">
        {t.loading ? <p className="py-8 text-center text-mute">در حال بارگذاری…</p> : list.length === 0 ? (
          <p className="rounded-row border-2 border-dashed border-line p-8 text-center text-mute">برای این روز کاری ثبت نشده. بالا اولین را بنویس.</p>
        ) : (
          <ul className="space-y-2.5">
            {list.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-row bg-surface p-3.5 shadow-card">
                <Check on={x.done} size={32} color="rgb(var(--mint))" label={x.title} onClick={() => t.toggle(x)} />
                <span className={`flex-1 ${x.done ? "text-mute line-through" : "font-bold"}`}>{x.title}</span>
                <button onClick={() => { setRem(x); setRemTime(x.remind_time?.slice(0, 5) ?? ""); }} aria-label="یادآور" className={`rounded-full px-2.5 py-1 text-xs font-bold ${x.event_id ? "bg-brand/10 text-brand" : "bg-soft text-mute"}`}>
                  🔔 {x.remind_time ? fa(x.remind_time.slice(0, 5)) : "یادآور"}
                </button>
                <button aria-label={`حذف ${x.title}`} className="px-1 text-mute opacity-60 hover:opacity-100" onClick={() => t.remove(x)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* آمار موفقیت */}
      <section className="mt-8 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-lg font-extrabold">آمار موفقیت</h2>
        <div className="flex items-center gap-5">
          <Donut pct={list.length ? done / list.length : 0} color="rgb(var(--mint))"><div className="text-lg font-extrabold">{pctText(list.length ? done / list.length : 0)}</div></Donut>
          <div className="space-y-1 text-sm">
            <p><span className="font-extrabold">{fa(done)}</span> از <span className="font-extrabold">{fa(list.length)}</span> کار این روز انجام شد</p>
            <p className="text-mute">۳۰ روز اخیر: {pctText(rate30)} موفقیت ({fa(last30.filter((x) => x.done).length)} از {fa(last30.length)})</p>
          </div>
        </div>
        <div className="mt-5 flex h-24 items-end gap-1" role="img" aria-label="درصد موفقیت ۱۴ روز اخیر">
          {last14.map((iso) => { const p = pct(iso); return (
            <div key={iso} className="flex flex-1 flex-col items-center gap-1" title={`${fa(fromISO(iso).jd)} ${MONTHS[fromISO(iso).jm - 1]}: ${p === null ? "بدون کار" : pctText(p)}`}>
              <div className="flex w-full flex-1 items-end overflow-hidden rounded-md bg-soft"><div className="w-full rounded-md bg-mint transition-[height]" style={{ height: `${(p ?? 0) * 100}%` }} /></div>
              <span className={`text-[10px] font-semibold ${iso === day ? "text-brand" : "text-mute"}`}>{fa(fromISO(iso).jd)}</span>
            </div>); })}
        </div>
      </section>

      <Sheet open={!!rem} onClose={() => setRem(null)} title="یادآور در تقویم گوگل">
        <p className="mb-4 text-sm text-mute">«{rem?.title}» در ساعت انتخابی به تقویم اضافه می‌شود و گوگل در همان لحظه اعلان می‌دهد.</p>
        <Field label="ساعت"><input type="time" className={inputCls} value={remTime} onChange={(e) => setRemTime(e.target.value)} /></Field>
        <div className="mt-5 flex gap-3">
          <button className={`${btnPrimary} flex-1`} disabled={!remTime} onClick={async () => { if (rem) await t.setReminder(rem, remTime); setRem(null); }}>ذخیره یادآور</button>
          {rem?.event_id && <button className={btnGhost} onClick={async () => { if (rem) await t.setReminder(rem, null); setRem(null); }}>حذف</button>}
        </div>
      </Sheet>
    </main>
  );
}
