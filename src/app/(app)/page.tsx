"use client";
import { useState } from "react";
import Link from "next/link";
import { addDays, fa, fromISO, MONTHS, prettyDate, todayISO, WEEKDAYS_SHORT, weekOfDay, weekStartISO } from "@/lib/jalali";
import { useMonth, useTodos } from "@/lib/data";
import { Bar, Check, pctText, SegRing, SyncBadge } from "@/components/ui";

const greet = () => { const h = +new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(new Date()); return h < 5 ? "شب بخیر" : h < 12 ? "صبح بخیر" : h < 17 ? "ظهر بخیر" : h < 20 ? "عصر بخیر" : "شب بخیر"; };

export default function Today() {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const j = fromISO(day);
  const m = useMonth(j.jy, j.jm);
  const t = useTodos(day, day);
  const habits = m.habits.filter((h) => !h.archived);
  const done = habits.filter((h) => m.isDone(h.id, day)).length;
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO(day), i));
  const weekGoals = m.goals.filter((g) => g.scope === "week" && g.slot === weekOfDay(j.jd));
  const dayPct = (iso: string) => { const q = fromISO(iso); return q.jy === j.jy && q.jm === j.jm && habits.length ? habits.filter((h) => m.isDone(h.id, iso)).length / habits.length : 0; };
  const todoDone = t.todos.filter((x) => x.done).length;

  // روزهای کامل پشت‌سرهم (داخل همین ماه)
  let streak = 0;
  for (let d = j.jd; d >= 1; d--) {
    const iso = addDays(day, d - j.jd);
    if (habits.length && habits.every((h) => m.isDone(h.id, iso))) streak++; else if (d !== j.jd) break; else if (iso !== today) break;
  }

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-mute">{greet()}</p>
          <h1 className="text-2xl font-extrabold">{day === today ? "امروز" : prettyDate(day).split(" ")[0]}، {fa(j.jd)} {MONTHS[j.jm - 1]}</h1>
        </div>
        <SyncBadge />
      </header>

      {/* قهرمان: حلقهٔ قطعه‌قطعه — هر عادت یک قطعه */}
      <section className="relative overflow-hidden rounded-hero bg-[#2A1B8C] p-6 text-white shadow-card dark:bg-[#241a6e]">
        <div aria-hidden className="absolute -start-16 -top-20 h-56 w-56 rounded-full bg-brand/60 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <SegRing size={170} stroke={15} segments={habits.map((h) => m.isDone(h.id, day))}>
            <div><div className="text-4xl font-extrabold leading-none">{pctText(habits.length ? done / habits.length : 0)}</div>
              <div className="mt-1 text-xs text-white/70">{fa(done)} از {fa(habits.length)} عادت</div></div>
          </SegRing>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-snug">{habits.length === 0 ? "اولین عادتت را بساز" : done === habits.length ? "همهٔ عادت‌های امروز انجام شد" : `${fa(habits.length - done)} عادت دیگر مانده`}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-semibold">
              <span aria-hidden className="text-amber">●</span> {fa(streak)} روز کامل پشت‌سرهم
            </div>
          </div>
        </div>
      </section>

      {/* نوار هفته */}
      <nav aria-label="روزهای هفته" className="mt-5 grid grid-cols-7 gap-1.5">
        {week.map((iso, i) => {
          const q = fromISO(iso), on = iso === day, p = dayPct(iso);
          return (
            <button key={iso} onClick={() => setDay(iso)} aria-pressed={on}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors ${on ? "bg-brand text-white shadow-card" : "bg-surface"}`}>
              <span className={`text-xs font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[i]}</span>
              <span className="text-base font-extrabold">{fa(q.jd)}</span>
              <span className="h-1.5 w-6 overflow-hidden rounded-full" style={{ background: on ? "rgba(255,255,255,.25)" : "rgb(var(--soft))" }}>
                <span className="block h-full rounded-full" style={{ width: `${p * 100}%`, background: on ? "#fff" : "rgb(var(--mint))" }} />
              </span>
              {iso === today && !on && <span className="sr-only">امروز</span>}
            </button>
          );
        })}
      </nav>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-extrabold">عادت‌های روزانه</h2><Link href="/habits" className="text-sm font-semibold text-brand">جدول ماه</Link></div>
        {m.loading ? <p className="py-8 text-center text-mute">در حال بارگذاری…</p> : habits.length === 0 ? (
          <Link href="/habits" className="block rounded-row border-2 border-dashed border-line p-6 text-center font-semibold text-brand">افزودن عادت از جدول ماه</Link>
        ) : (
          <ul className="space-y-2.5">
            {habits.map((h) => {
              const on = m.isDone(h.id, day), c = m.countOf(h.id), tg = m.targetOf(h);
              return (
                <li key={h.id} className="flex items-center gap-3.5 rounded-row bg-surface p-3.5 shadow-card">
                  <Check on={on} color={h.color} size={36} label={`${h.name.trim()} — ${on ? "انجام شده" : "انجام نشده"}`} onClick={() => m.toggle(h, day)} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-bold ${on ? "text-mute line-through decoration-2" : ""}`}>{h.name.trim()}</p>
                    <div className="mt-1.5 flex items-center gap-2"><div className="flex-1"><Bar value={c} max={tg} color={h.color} /></div><span className="text-xs font-semibold text-mute">{fa(c)} / {fa(tg)}</span></div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-extrabold">کارهای این روز</h2><Link href="/todos" className="text-sm font-semibold text-brand">همه</Link></div>
        {t.todos.length === 0 ? <p className="rounded-row bg-surface p-4 text-center text-mute">کاری برای این روز ثبت نشده</p> : (
          <ul className="space-y-2">
            {t.todos.slice(0, 4).map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-row bg-surface p-3 shadow-card">
                <Check on={x.done} size={28} color="rgb(var(--mint))" label={x.title} onClick={() => t.toggle(x)} />
                <span className={`flex-1 truncate ${x.done ? "text-mute line-through" : "font-semibold"}`}>{x.title}</span>
                {x.remind_time && <span className="text-xs font-semibold text-mute">{fa(x.remind_time.slice(0, 5))}</span>}
              </li>
            ))}
            {t.todos.length > 4 && <li className="text-center text-sm text-mute">و {fa(t.todos.length - 4)} کار دیگر · {fa(todoDone)} انجام شده</li>}
          </ul>
        )}
      </section>

      {weekGoals.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-lg font-extrabold">هدف‌های این هفته</h2>
          <ul className="space-y-2">
            {weekGoals.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-row bg-surface p-3 shadow-card">
                <Check on={g.done} size={28} color="rgb(var(--plum))" label={g.title} onClick={() => m.toggleGoal(g)} />
                <span className={`flex-1 ${g.done ? "text-mute line-through" : "font-semibold"}`}>{g.title.trim()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
