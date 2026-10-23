"use client";
import { useEffect, useMemo, useState } from "react";
import { addDays, fa, fromISO, monthLength, MONTHS, shiftMonth, toISO, todayISO } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { sb } from "@/lib/supabase-browser";
import Link from "next/link";
import { Bar, CalendarBadge, Donut, pctText } from "@/components/ui";

export default function Stats() {
  const now = fromISO(todayISO());
  const m = useMonth(now.jy, now.jm);
  const [hist, setHist] = useState<{ jy: number; jm: number; n: number }[]>([]);
  const [todo30, setTodo30] = useState({ done: 0, all: 0 });
  const [recent, setRecent] = useState<Record<string, number>>({});
  const active = m.habits.filter((h) => !h.archived);

  useEffect(() => {
    (async () => {
      const first = shiftMonth(now.jy, now.jm, -5);
      const start = toISO({ ...first, jd: 1 });
      const { data } = await sb().from("habit_logs").select("day").eq("done", true).gte("day", start);
      const cnt: Record<string, number> = {}; const perDay: Record<string, number> = {};
      (data ?? []).forEach((x: any) => { const q = fromISO(x.day); const k = `${q.jy}-${q.jm}`; cnt[k] = (cnt[k] ?? 0) + 1; perDay[x.day] = (perDay[x.day] ?? 0) + 1; });
      setHist(Array.from({ length: 6 }, (_, i) => { const s = shiftMonth(first.jy, first.jm, i); return { ...s, n: cnt[`${s.jy}-${s.jm}`] ?? 0 }; }));
      setRecent(perDay);
      const t = await sb().from("todos").select("done").gte("day", addDays(todayISO(), -29)).lte("day", todayISO());
      setTodo30({ done: (t.data ?? []).filter((x: any) => x.done).length, all: (t.data ?? []).length });
    })();
  }, [now.jy, now.jm]);

  const total = active.reduce((s, h) => s + m.countOf(h.id), 0);
  const target = active.reduce((s, h) => s + m.targetOf(h), 0);
  const len = monthLength(now.jy, now.jm);
  const days = Array.from({ length: len }, (_, i) => i + 1);
  const dayPct = (d: number) => (active.length ? active.filter((h) => m.isDone(h.id, toISO({ ...now, jd: d }))).length / active.length : 0);

  const best = useMemo(() => {
    if (!active.length) return { cur: 0, best: 0 };
    let cur = 0, best = 0;
    for (let i = 89; i >= 0; i--) { const iso = addDays(todayISO(), -i); if ((recent[iso] ?? 0) >= active.length) { cur++; best = Math.max(best, cur); } else if (i !== 0) cur = 0; else cur = 0; }
    return { cur, best };
  }, [recent, active.length]);
  const maxHist = Math.max(1, ...hist.map((h) => h.n));
  const weeks = [1, 2, 3, 4, 5].map((w) => m.goals.filter((g) => g.scope === "week" && g.slot === w));
  const mo = m.goals.filter((g) => g.scope === "month");

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">آمار {MONTHS[now.jm - 1]} {fa(now.jy)}</h1>
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

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-hero bg-brand p-5 text-white shadow-card">
          <Donut pct={target ? total / target : 0} color="#fff" size={92} stroke={10}><span className="text-lg font-extrabold">{pctText(target ? total / target : 0)}</span></Donut>
          <p className="mt-3 text-sm font-semibold text-white/80">{fa(total)} از {fa(target)} تیک هدف</p>
        </div>
        <div className="flex flex-col justify-between rounded-hero bg-surface p-5 shadow-card">
          <div><p className="text-sm font-semibold text-mute">روز کامل پشت‌سرهم</p><p className="text-4xl font-extrabold">{fa(best.cur)}</p></div>
          <p className="text-sm text-mute">بهترین: <b className="text-ink">{fa(best.best)}</b> روز (۹۰ روز اخیر)</p>
        </div>
      </section>

      <section className="mt-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-lg font-extrabold">پیشرفت روزانه</h2><p className="mb-4 text-sm text-mute">چند درصد عادت‌های هر روز انجام شد</p>
        <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="نمودار پیشرفت روزانه ماه">
          {days.map((d) => <div key={d} className="flex h-full flex-1 items-end rounded bg-soft" title={`${fa(d)}: ${pctText(dayPct(d))}`}><div className="w-full rounded bg-mint" style={{ height: `${dayPct(d) * 100}%` }} /></div>)}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-mute"><span>{fa(1)}</span><span>{fa(Math.round(len / 2))}</span><span>{fa(len)}</span></div>
      </section>

      <section className="mt-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-lg font-extrabold">هر عادت</h2>
        <ul className="space-y-4">
          {active.map((h) => (
            <li key={h.id}><div className="mb-1.5 flex justify-between text-sm"><span className="font-bold">{h.name.trim()}</span><span className="font-semibold text-mute">{fa(m.countOf(h.id))} / {fa(m.targetOf(h))}</span></div><Bar value={m.countOf(h.id)} max={m.targetOf(h)} color={h.color} /></li>
          ))}
          {!active.length && <p className="text-mute">هنوز عادتی نداری.</p>}
        </ul>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-hero bg-surface p-5 shadow-card"><p className="text-sm font-semibold text-mute">هدف‌های هفتگی</p>
          <p className="text-3xl font-extrabold">{pctText(weeks.flat().length ? weeks.flat().filter((g) => g.done).length / weeks.flat().length : 0)}</p>
          <p className="text-xs text-mute">{fa(weeks.flat().filter((g) => g.done).length)} از {fa(weeks.flat().length)}</p></div>
        <div className="rounded-hero bg-surface p-5 shadow-card"><p className="text-sm font-semibold text-mute">هدف‌های ماهانه</p>
          <p className="text-3xl font-extrabold">{pctText(mo.length ? mo.filter((g) => g.done).length / mo.length : 0)}</p>
          <p className="text-xs text-mute">{fa(mo.filter((g) => g.done).length)} از {fa(mo.length)}</p></div>
      </section>

      <section className="mt-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-lg font-extrabold">کارهای روزانه، ۳۰ روز اخیر</h2>
        <p className="text-3xl font-extrabold">{pctText(todo30.all ? todo30.done / todo30.all : 0)}</p>
        <p className="text-sm text-mute">{fa(todo30.done)} کار از {fa(todo30.all)} انجام شد</p>
      </section>

      <section className="mt-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-lg font-extrabold">تعداد تیک، ۶ ماه اخیر</h2>
        <div className="flex h-32 items-end gap-2">
          {hist.map((h) => (
            <div key={`${h.jy}${h.jm}`} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end rounded-xl bg-soft"><div className="w-full rounded-xl bg-brand" style={{ height: `${(h.n / maxHist) * 100}%` }} /></div>
              <span className="text-[11px] font-semibold text-mute">{MONTHS[h.jm - 1]}</span><span className="text-[11px] font-extrabold">{fa(h.n)}</span>
            </div>))}
        </div>
      </section>
    </main>
  );
}
