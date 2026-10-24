"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { addDays, fa, fromISO, monthLength, MONTHS, shiftMonth, toISO, todayISO, WEEKDAYS, WEEKDAYS_SHORT, weekdayIndex } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { sb } from "@/lib/supabase-browser";
import { CalendarBadge, Donut, pctText } from "@/components/ui";
import { AreaChart, Gauge, Heatmap, MonthBars, WeekdayBars } from "@/components/charts";

const Card = ({ title, sub, right, children, className = "" }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-hero bg-surface p-5 shadow-card ${className}`}>
    {(title || right) && (
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>{title && <h2 className="text-lg font-extrabold">{title}</h2>}{sub && <p className="mt-0.5 text-sm text-mute">{sub}</p>}</div>
        {right}
      </div>
    )}
    {children}
  </section>
);

export default function Stats() {
  const now = fromISO(todayISO());
  const today = todayISO();
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
  const pct = target ? total / target : 0;
  const len = monthLength(now.jy, now.jm);
  const iso = (d: number) => toISO({ ...now, jd: d });
  const dayPct = (d: number) => (active.length ? active.filter((h) => m.isDone(h.id, iso(d))).length / active.length : 0);
  const days = Array.from({ length: len }, (_, i) => i + 1);

  const streak = useMemo(() => {
    if (!active.length) return { cur: 0, best: 0 };
    let cur = 0, best = 0;
    for (let i = 89; i >= 0; i--) { const d = addDays(today, -i); if ((recent[d] ?? 0) >= active.length) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return { cur, best };
  }, [recent, active.length, today]);

  const weekday = useMemo(() => {
    const sum = Array(7).fill(0), cnt = Array(7).fill(0);
    if (active.length) for (let i = 0; i < 90; i++) { const d = addDays(today, -i), w = weekdayIndex(d); sum[w] += Math.min(1, (recent[d] ?? 0) / active.length); cnt[w]++; }
    const vals = sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
    const max = Math.max(...vals);
    return { vals, best: max > 0 ? vals.indexOf(max) : -1 };
  }, [recent, active.length, today]);

  const ranked = [...active].map((h) => ({ h, p: m.targetOf(h) ? m.countOf(h.id) / m.targetOf(h) : 0 })).sort((a, b) => b.p - a.p);
  const bestH = ranked[0], worstH = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const cells = days.map((d) => ({ d, p: d <= now.jd ? dayPct(d) : null, today: d === now.jd }));
  const offset = weekdayIndex(iso(1));
  const areaVals = days.map((d) => (d <= now.jd ? dayPct(d) : null));
  const weeks = [1, 2, 3, 4, 5].map((w) => m.goals.filter((g) => g.scope === "week" && g.slot === w)).flat();
  const mo = m.goals.filter((g) => g.scope === "month");
  const wp = weeks.length ? weeks.filter((g) => g.done).length / weeks.length : 0;
  const mp = mo.length ? mo.filter((g) => g.done).length / mo.length : 0;
  const maxHist = Math.max(1, ...hist.map((h) => h.n));

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-5 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-mute">گزارش عملکرد</p><h1 className="text-2xl font-extrabold">{MONTHS[now.jm - 1]} {fa(now.jy)}</h1></div>
        <div className="flex items-center gap-2">
          <CalendarBadge />
          <Link href="/settings" aria-label="تنظیمات" className="grid h-8 w-8 place-items-center rounded-full bg-surface text-sm text-mute shadow-card transition-transform hover:text-ink active:scale-95">⚙️</Link>
        </div>
      </header>

      {/* قهرمان */}
      <section className="relative overflow-hidden rounded-hero p-5 text-white shadow-card" style={{ background: "linear-gradient(135deg, #2A1B8C 0%, rgb(var(--brand)) 70%, rgb(var(--plum)) 130%)" }}>
        <div aria-hidden className="absolute -end-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-5">
          <Donut pct={pct} color="#fff" size={116} stroke={13}>
            <div><div className="text-2xl font-extrabold leading-none">{pctText(pct)}</div><div className="mt-1 text-[10px] text-white/70">هدف ماه</div></div>
          </Donut>
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            {[[fa(total), "تیک انجام‌شده"], [fa(Math.max(target - total, 0)), "تیک باقی‌مانده"], [fa(streak.cur), "روز کامل پیاپی"], [fa(streak.best), "بهترین رکورد"]].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/12 px-3 py-2"><div className="text-lg font-extrabold leading-tight">{v}</div><div className="text-[11px] text-white/70">{l}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* بینش‌های سریع */}
      {active.length > 0 && (
        <div className="no-scrollbar -mx-3 mt-4 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
          {bestH && <Insight emoji="🏆" label="قوی‌ترین عادت" value={bestH.h.name.trim()} note={pctText(bestH.p)} color={bestH.h.color} />}
          {worstH && <Insight emoji="🌱" label="نیازمند توجه" value={worstH.h.name.trim()} note={pctText(worstH.p)} color={worstH.h.color} />}
          {weekday.best >= 0 && <Insight emoji="📅" label="بهترین روز هفته" value={WEEKDAYS[weekday.best]} note={pctText(weekday.vals[weekday.best])} color="#26BCD0" />}
        </div>
      )}

      <Card className="mt-4" title="تقویم فعالیت" sub="هر خانه یک روز؛ هرچه پررنگ‌تر، عادت بیشتری انجام شده">
        <Heatmap cells={cells} offset={offset} weekdays={WEEKDAYS_SHORT} />
      </Card>

      <Card className="mt-4" title="روند ماه" sub="درصد عادت‌های انجام‌شده در هر روز"
        right={<span className="rounded-full bg-soft px-3 py-1 text-xs font-extrabold text-brand">امروز {pctText(dayPct(now.jd))}</span>}>
        <AreaChart values={areaVals} todayIndex={now.jd - 1} />
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-mute"><span>{fa(1)}</span><span>{fa(Math.round(len / 2))}</span><span>{fa(len)}</span></div>
      </Card>

      <Card className="mt-4" title="کدام روزها قوی‌ترم؟" sub="میانگین ۹۰ روز اخیر به تفکیک روز هفته">
        <WeekdayBars values={weekday.vals} labels={WEEKDAYS_SHORT} best={weekday.best} />
      </Card>

      <Card className="mt-4" title="عادت‌ها" sub="مرتب‌شده بر اساس پیشرفت این ماه">
        {ranked.length === 0 ? <p className="text-mute">هنوز عادتی نداری.</p> : (
          <ul className="grid grid-cols-2 gap-3">
            {ranked.map(({ h, p }) => (
              <li key={h.id} className="flex flex-col items-center rounded-3xl bg-bg p-3.5 text-center">
                <Donut pct={p} size={72} stroke={8} color={h.color}><span className="text-sm font-extrabold">{pctText(p)}</span></Donut>
                <p className="mt-2 w-full truncate text-sm font-bold">{h.name.trim()}</p>
                <p className="text-xs font-semibold text-mute">{fa(m.countOf(h.id))} از {fa(m.targetOf(h))} روز</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-hero bg-surface p-4 shadow-card">
          <p className="mb-3 text-center text-sm font-bold text-mute">هدف‌های هفتگی</p>
          <Gauge pct={wp} color="rgb(var(--plum))" size={130}><div className="text-2xl font-extrabold">{pctText(wp)}</div></Gauge>
          <p className="mt-2 text-center text-xs text-mute">{fa(weeks.filter((g) => g.done).length)} از {fa(weeks.length)}</p>
        </div>
        <div className="rounded-hero bg-surface p-4 shadow-card">
          <p className="mb-3 text-center text-sm font-bold text-mute">هدف‌های ماهانه</p>
          <Gauge pct={mp} color="rgb(var(--brand))" size={130}><div className="text-2xl font-extrabold">{pctText(mp)}</div></Gauge>
          <p className="mt-2 text-center text-xs text-mute">{fa(mo.filter((g) => g.done).length)} از {fa(mo.length)}</p>
        </div>
      </section>

      <Card className="mt-4">
        <div className="flex items-center gap-4">
          <Donut pct={todo30.all ? todo30.done / todo30.all : 0} size={84} stroke={10} color="rgb(var(--amber))">
            <span className="text-base font-extrabold">{pctText(todo30.all ? todo30.done / todo30.all : 0)}</span>
          </Donut>
          <div><h2 className="text-lg font-extrabold">کارهای روزانه</h2><p className="text-sm text-mute">۳۰ روز اخیر</p>
            <p className="mt-1 text-sm font-semibold">{fa(todo30.done)} انجام شد · {fa(todo30.all - todo30.done)} مانده</p></div>
        </div>
      </Card>

      <Card className="mt-4" title="مقایسهٔ ۶ ماه اخیر" sub="مجموع تیک‌های هر ماه">
        <MonthBars max={maxHist} items={hist.map((h, i) => ({ label: MONTHS[h.jm - 1], n: h.n, current: i === hist.length - 1 }))} />
      </Card>
    </main>
  );
}

function Insight({ emoji, label, value, note, color }: { emoji: string; label: string; value: string; note: string; color: string }) {
  return (
    <div className="flex min-w-44 shrink-0 items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-card">
      <span className="grid h-11 w-11 place-items-center rounded-2xl text-xl" style={{ background: `${color}22` }}>{emoji}</span>
      <div className="min-w-0"><p className="text-[11px] font-semibold text-mute">{label}</p><p className="max-w-28 truncate text-sm font-extrabold">{value}</p><p className="text-xs font-bold" style={{ color }}>{note}</p></div>
    </div>
  );
}
