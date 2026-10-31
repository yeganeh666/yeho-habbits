"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, fa, fromISO, monthRange, MONTHS, prettyDate, todayISO, WEEKDAYS_SHORT, weekOfDay, weekStartISO } from "@/lib/jalali";
import { useMonth, useTodos } from "@/lib/data";
import { Check, CalendarBadge, Donut, pctText, SegRing } from "@/components/ui";
import { dayStreaks, habitStreak } from "@/lib/recurrence";
import type { Todo } from "@/lib/types";

const tehranHM = () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(new Date());
const greet = () => { const h = +tehranHM().slice(0, 2); return h < 5 ? "شب بخیر" : h < 12 ? "صبح بخیر" : h < 17 ? "ظهر بخیر" : h < 20 ? "عصر بخیر" : "شب بخیر"; };
const toMin = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);

export default function Today() {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [now, setNow] = useState(tehranHM());
  const [draft, setDraft] = useState("");
  useEffect(() => { const id = setInterval(() => setNow(tehranHM()), 30000); return () => clearInterval(id); }, []);

  const j = fromISO(day);
  const isToday = day === today;
  const m = useMonth(j.jy, j.jm);
  const t = useTodos(day, day);
  // همهٔ عادت‌های فعال؛ و آن‌هایی که امروز (روز انتخاب‌شده) نوبت دارند یا تیک خورده‌اند
  const allHabits = m.habits.filter((h) => !h.archived);
  const habits = m.habitsOn(day);
  const done = habits.filter((h) => m.isDone(h.id, day)).length;
  const allDone = habits.length > 0 && done === habits.length;
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO(day), i));
  const weekGoals = m.goals.filter((g) => g.scope === "week" && g.slot === weekOfDay(j.jd));
  const monthEnd = monthRange(j.jy, j.jm).end;
  const dayPct = (iso: string) => { if (iso > monthEnd) return 0; const list = m.habitsOn(iso); return list.length ? list.filter((h) => m.isDone(h.id, iso)).length / list.length : 0; };

  const events = t.todos.filter((x) => x.remind_time);
  const tasks = t.todos.filter((x) => !x.remind_time);
  const todoDone = t.todos.filter((x) => x.done).length;
  const next = isToday ? events.find((x) => !x.done && toMin(x.remind_time!) >= toMin(now)) : undefined;

  // رکورد فقط روزهای نوبتِ هر عادت را می‌شمارد و از ماه‌های قبل هم عبور می‌کند
  const streakOf = (h: (typeof allHabits)[number]) => habitStreak(h, (d) => m.isDone(h.id, d), day);
  const dayStreak = dayStreaks(allHabits, (h, d) => m.isDone(h.id, d), day).cur;

  const remaining = habits.length - done;
  const headline = allHabits.length === 0 ? "اولین عادتت را بساز" : habits.length === 0 ? "امروز عادتی نداری" : allDone ? "عالی بود! همه انجام شد" : done === 0 ? "امروز را شروع کن" : `${fa(remaining)} عادت تا پایان روز مانده`;
  const sub = allHabits.length === 0 ? "با یک عادت کوچک شروع کن" : habits.length === 0 ? "روز استراحت است 🌤️" : allDone ? "امشب با خیال راحت بخواب 🌙" : done === 0 ? "اولین تیک سخته‌ترینش است" : "کم مانده، ادامه بده";

  const addQuick = async (e: React.FormEvent) => { e.preventDefault(); const v = draft.trim(); if (!v) return; setDraft(""); await t.add(day, v, null); };

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-mute">{isToday ? greet() : "روز انتخاب‌شده"}</p>
          <h1 className="text-2xl font-extrabold">{isToday ? "امروز" : prettyDate(day).split(" ")[0]}، {fa(j.jd)} {MONTHS[j.jm - 1]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CalendarBadge />
          <Link href="/settings" aria-label="تنظیمات" className="grid h-8 w-8 place-items-center rounded-full bg-surface text-sm text-mute shadow-card transition-transform hover:text-ink active:scale-95">⚙️</Link>
        </div>
      </header>

      {/* قهرمان */}
      <section className="relative overflow-hidden rounded-hero p-6 text-white shadow-pop" style={{ background: allDone ? "linear-gradient(135deg,#0f6b5c 0%,#26BCD0 100%)" : "linear-gradient(145deg,#1d1470 0%,#4a2fd6 55%,#8a2fa8 130%)" }}>
        <div aria-hidden className="absolute -start-14 -top-20 h-60 w-60 animate-pulse rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -end-10 h-56 w-56 rounded-full bg-amber/25 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <SegRing size={158} stroke={14} segments={habits.map((h) => m.isDone(h.id, day))} onColor="#fff" offColor="rgba(255,255,255,.2)">
            <div>
              <div className="text-[2.1rem] font-extrabold leading-none">{pctText(habits.length ? done / habits.length : 0)}</div>
              <div className="mt-1 text-[11px] font-semibold text-white/75">{fa(done)} از {fa(habits.length)} عادت</div>
            </div>
          </SegRing>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-snug">{headline}</p>
            <p className="mt-1 text-sm text-white/75">{sub}</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          {[["🔥", fa(dayStreak), "روز کامل پیاپی"], ["✅", `${fa(todoDone)}/${fa(t.todos.length)}`, "کارهای روز"], ["📅", fa(events.length), "رویداد"]].map(([e, v, l]) => (
            <div key={l} className="rounded-2xl bg-white/12 px-2 py-2.5 backdrop-blur-sm"><div className="text-base font-extrabold leading-tight"><span className="me-1 text-sm">{e}</span>{v}</div><div className="mt-0.5 text-[11px] text-white/70">{l}</div></div>
          ))}
        </div>
      </section>

      {/* رویداد بعدی */}
      {next && (
        <Link href="/todos" className="mt-4 flex items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-card ring-1 ring-brand/20 active:scale-[.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-xl">{next.event_type === "meeting" ? "📅" : "🔔"}</span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-brand">رویداد بعدی</span><span className="block truncate font-extrabold">{next.title}</span></span>
          <span className="text-end"><span className="block text-sm font-extrabold">{fa(next.remind_time!.slice(0, 5))}</span><span className="block text-[11px] font-semibold text-mute">{until(toMin(next.remind_time!) - toMin(now))}</span></span>
        </Link>
      )}

      {/* نوار هفته */}
      <nav aria-label="روزهای هفته" className="mt-5 grid grid-cols-7 gap-1.5">
        {week.map((iso, i) => {
          const q = fromISO(iso), on = iso === day, p = dayPct(iso);
          return (
            <button key={iso} onClick={() => setDay(iso)} aria-pressed={on} aria-label={`${fa(q.jd)} ${MONTHS[q.jm - 1]}`}
              className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition-all active:scale-95 ${on ? "bg-brand text-white shadow-card" : "bg-surface"}`}>
              <span className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[i]}</span>
              <Donut pct={p} size={34} stroke={3.5} color={on ? "#fff" : "rgb(var(--mint))"}><span className="text-[13px] font-extrabold">{fa(q.jd)}</span></Donut>
              <span className={`h-1 w-1 rounded-full ${iso === today ? (on ? "bg-white" : "bg-brand") : "bg-transparent"}`} />
            </button>
          );
        })}
      </nav>

      {/* عادت‌ها */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">عادت‌های روز{habits.length > 0 && <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-bold text-brand">{fa(done)}/{fa(habits.length)}</span>}</h2>
          <Link href="/habits" className="text-sm font-semibold text-brand">همهٔ ماه ‹</Link>
        </div>
        {m.loading ? (
          <ul className="space-y-2.5" aria-busy>{[0, 1, 2].map((i) => <li key={i} className="h-[72px] animate-pulse rounded-row bg-surface/70" />)}</ul>
        ) : allHabits.length === 0 ? (
          <Link href="/habits" className="block rounded-hero border-2 border-dashed border-line p-6 text-center font-bold text-brand">+ افزودن عادت</Link>
        ) : habits.length === 0 ? (
          <p className="rounded-row bg-surface p-4 text-center text-sm text-mute">برای این روز عادتی برنامه‌ریزی نشده 🌤️</p>
        ) : (
          <ul className="space-y-2.5">
            {habits.map((h) => {
              const on = m.isDone(h.id, day), c = m.countOf(h.id), tg = m.targetOf(h), st = streakOf(h);
              return (
                <li key={h.id}>
                  <button onClick={() => m.toggle(h, day)} aria-pressed={on} aria-label={`${h.name.trim()} — ${on ? "انجام شده" : "انجام نشده"}`}
                    className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-row p-3.5 text-start shadow-card transition-all active:scale-[.98]"
                    style={{ background: on ? `color-mix(in srgb, ${h.color} 14%, rgb(var(--surface)))` : "rgb(var(--surface))" }}>
                    <span aria-hidden className="absolute inset-y-3 start-0 w-1 rounded-e-full" style={{ background: h.color }} />
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors" style={{ borderColor: on ? h.color : "rgb(var(--line))", background: on ? h.color : "transparent" }}>
                      {on && <svg className="pop" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-bold ${on ? "text-mute line-through decoration-2" : ""}`}>{h.name.trim()}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, tg ? (c / tg) * 100 : 0)}%`, background: h.color }} /></span>
                        <span className="text-[11px] font-semibold text-mute">{fa(c)}/{fa(tg)}</span>
                      </span>
                    </span>
                    {st > 1 && <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ background: `${h.color}22`, color: h.color }}>🔥 {fa(st)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* برنامهٔ روز: رویدادها + کارها */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">برنامهٔ روز</h2>
          <Link href="/todos" className="text-sm font-semibold text-brand">همه ‹</Link>
        </div>

        {events.length > 0 && (
          <ul className="mb-3">
            {events.map((x, i) => <EventRow key={x.id} x={x} last={i === events.length - 1} past={isToday && toMin(x.remind_time!) < toMin(now)} onToggle={() => t.toggle(x)} />)}
          </ul>
        )}
        {tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.slice(0, 5).map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-row bg-surface p-3 shadow-card">
                <Check on={x.done} size={28} color="rgb(var(--mint))" label={x.title} onClick={() => t.toggle(x)} />
                <span className={`flex-1 truncate ${x.done ? "text-mute line-through" : "font-semibold"}`}>{x.title}</span>
              </li>
            ))}
            {tasks.length > 5 && <li className="text-center text-sm text-mute">و {fa(tasks.length - 5)} کار دیگر</li>}
          </ul>
        )}
        {t.todos.length === 0 && !t.loading && <p className="rounded-row bg-surface p-4 text-center text-sm text-mute">برای این روز برنامه‌ای نداری 🌤️</p>}

        <form onSubmit={addQuick} className="mt-3 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="کار تازه اضافه کن…" aria-label="کار تازه" className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-brand" />
          <button disabled={!draft.trim()} className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl font-bold text-white shadow-card transition-transform active:scale-90 disabled:opacity-40" aria-label="افزودن">+</button>
        </form>
      </section>

      {weekGoals.length > 0 && (
        <section className="mt-8">
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

const until = (mins: number) => (mins <= 0 ? "همین حالا" : mins < 60 ? `${fa(mins)} دقیقه دیگر` : `${fa(Math.floor(mins / 60))} ساعت دیگر`);

function EventRow({ x, last, past, onToggle }: { x: Todo; last: boolean; past: boolean; onToggle: () => void }) {
  const meeting = x.event_type === "meeting", color = meeting ? "rgb(var(--brand))" : "rgb(var(--mint))";
  return (
    <li className="flex gap-3">
      <div className="w-11 shrink-0 pt-3.5 text-center"><span className={`text-sm font-extrabold ${past && !x.done ? "text-mute" : ""}`}>{fa(x.remind_time!.slice(0, 5))}</span></div>
      <div className="flex flex-col items-center"><span className="mt-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-bg" style={{ background: color }} />{!last && <span className="w-0.5 flex-1 bg-line" />}</div>
      <div className={`mb-2.5 flex flex-1 items-center gap-3 rounded-row bg-surface p-3 shadow-card ${past && !x.done ? "opacity-70" : ""}`}>
        <Check on={x.done} size={28} color={color} label={x.title} onClick={onToggle} />
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${x.done ? "text-mute line-through" : ""}`}>{x.title}</p>
          <p className="text-[11px] font-semibold text-mute">{meeting ? `جلسه${x.duration_minutes ? ` · ${fa(x.duration_minutes)} دقیقه` : ""}` : "یادآور"}</p>
        </div>
      </div>
    </li>
  );
}
