"use client";
import { useState } from "react";
import Link from "next/link";
import { fa, fromISO, monthLength, MONTHS, shiftMonth, toISO, todayISO, WEEKDAYS_SHORT, weekdayIndex, WEEK_LABELS } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { Bar, Check, pctText, CalendarBadge } from "@/components/ui";
import { HabitSheet } from "@/components/habit-sheet";
import type { Habit } from "@/lib/types";

export default function HabitsMonth() {
  const now = fromISO(todayISO());
  const [ym, setYm] = useState({ jy: now.jy, jm: now.jm });
  const m = useMonth(ym.jy, ym.jm);
  const [edit, setEdit] = useState<Habit | null>(null);
  const [open, setOpen] = useState(false);
  const len = monthLength(ym.jy, ym.jm);
  const days = Array.from({ length: len }, (_, i) => i + 1);
  const iso = (d: number) => toISO({ ...ym, jd: d });
  const today = todayISO();
  const habits = m.habits;
  const active = habits.filter((h) => !h.archived);

  const totalDone = habits.reduce((s, h) => s + m.countOf(h.id), 0);
  const totalTarget = habits.reduce((s, h) => s + m.targetOf(h), 0);
  const dayDone = (d: number) => active.filter((h) => m.isDone(h.id, iso(d))).length;

  return (
    <main>
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button aria-label="ماه بعد" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, 1))}>‹</button>
          <h1 className="min-w-36 text-center text-xl font-extrabold">{MONTHS[ym.jm - 1]} {fa(ym.jy)}</h1>
          <button aria-label="ماه قبل" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, -1))}>›</button>
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

      <div className="mb-4 flex items-center gap-4 rounded-row bg-surface p-4 shadow-card">
        <div className="flex-1"><p className="text-sm font-semibold text-mute">پیشرفت ماه</p><p className="text-2xl font-extrabold">{pctText(totalTarget ? totalDone / totalTarget : 0)}</p></div>
        <div className="w-40"><Bar value={totalDone} max={totalTarget} /><p className="mt-1.5 text-xs font-semibold text-mute">{fa(totalDone)} از {fa(totalTarget)} تیک هدف</p></div>
      </div>

      {/* جدول ماه — همان شیت */}
      <section aria-label="جدول عادت‌های ماه" className="overflow-hidden rounded-hero bg-surface shadow-card">
        <div className="no-scrollbar overflow-x-auto">
          <table className="border-separate border-spacing-0 text-center">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 min-w-40 bg-surface p-3 text-start text-sm font-bold text-mute">عادت</th>
                {days.map((d) => {
                  const on = iso(d) === today;
                  return (
                    <th key={d} className={`px-0.5 pb-2 pt-3 ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
                      <div className={`mx-auto w-8 rounded-xl py-1 ${on ? "bg-brand text-white" : ""}`}>
                        <div className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[weekdayIndex(iso(d))]}</div>
                        <div className="text-sm font-extrabold">{fa(d)}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {m.loading ? <tr><td className="p-6 text-mute" colSpan={len + 1}>در حال بارگذاری…</td></tr> : habits.map((h) => (
                <tr key={h.id}>
                  <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start">
                    <button className="block w-full text-start" onClick={() => { setEdit(h); setOpen(true); }}>
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} />
                        <span className="max-w-32 truncate text-sm font-bold">{h.name.trim()}</span></span>
                      <span className="mt-1.5 flex items-center gap-2"><span className="w-14"><Bar value={m.countOf(h.id)} max={m.targetOf(h)} color={h.color} /></span>
                        <span className="text-[11px] font-semibold text-mute">{fa(m.countOf(h.id))} / {fa(m.targetOf(h))}</span></span>
                    </button>
                  </th>
                  {days.map((d) => {
                    const on = m.isDone(h.id, iso(d));
                    return (
                      <td key={d} className={`p-0.5 ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
                        <button aria-label={`${h.name.trim()} روز ${fa(d)}`} aria-pressed={on} onClick={() => m.toggle(h, iso(d))}
                          className="mx-auto block h-8 w-8 rounded-[10px] transition-colors"
                          style={{ background: on ? h.color : "rgb(var(--soft))" }}>
                          {on && <svg className="mx-auto pop" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!m.loading && (
                <tr>
                  <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start text-sm font-bold text-mute">پیشرفت روز</th>
                  {days.map((d) => {
                    const p = active.length ? dayDone(d) / active.length : 0;
                    return <td key={d} className={`px-0.5 pb-3 pt-2 align-bottom ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
                      <div title={pctText(p)} className="mx-auto flex h-14 w-8 items-end overflow-hidden rounded-lg bg-soft"><div className="w-full rounded-lg bg-mint transition-[height]" style={{ height: `${p * 100}%` }} /></div></td>;
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!m.loading && habits.length === 0 && <p className="p-6 text-center text-mute">هنوز عادتی نداری. با دکمهٔ پایین اولی را بساز.</p>}
      </section>

      <button onClick={() => { setEdit(null); setOpen(true); }} className="mt-4 w-full rounded-row border-2 border-dashed border-line py-4 font-bold text-brand">+ عادت جدید</button>

      <Goals m={m} />

      <HabitSheet open={open} onClose={() => setOpen(false)} habit={edit} defaultTarget={edit ? m.targetOf(edit) : len}
        onSave={async (v) => { edit ? await m.updateHabit(edit.id, { name: v.name, color: v.color }, v.target) : await m.addHabit({ name: v.name, target: v.target, color: v.color }); }}
        onArchive={edit ? async () => { await m.updateHabit(edit.id, { archived: true }); } : undefined} />
    </main>
  );
}

function Goals({ m }: { m: ReturnType<typeof useMonth> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const add = async (scope: "week" | "month", slot: number, key: string) => { const t = (draft[key] ?? "").trim(); if (!t) return; setDraft((p) => ({ ...p, [key]: "" })); await m.addGoal(scope, slot, t); };
  const Card = ({ title, scope, slot, color, list }: { title: string; scope: "week" | "month"; slot: number; color: string; list: typeof m.goals }) => {
    const key = `${scope}${slot}`, done = list.filter((g) => g.done).length;
    return (
      <div className="rounded-row bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold">{title}</h3><span className="text-xs font-bold text-mute">{fa(done)}/{fa(list.length)}</span></div>
        <Bar value={done} max={list.length} color={color} />
        <ul className="mt-3 space-y-2">
          {list.map((g) => (
            <li key={g.id} className="group flex items-center gap-3">
              <Check on={g.done} size={26} color={color} label={g.title} onClick={() => m.toggleGoal(g)} />
              <span className={`flex-1 text-sm ${g.done ? "text-mute line-through" : "font-semibold"}`}>{g.title.trim()}</span>
              <button aria-label={`حذف ${g.title}`} className="px-1 text-mute opacity-60 hover:opacity-100" onClick={() => m.removeGoal(g)}>✕</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(scope, slot, key); }}>
          <input value={draft[key] ?? ""} onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))} placeholder="هدف جدید…" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
          <button className="rounded-xl bg-soft px-3 text-sm font-bold text-brand">افزودن</button>
        </form>
      </div>
    );
  };
  const wk = (s: number) => m.goals.filter((g) => g.scope === "week" && g.slot === s);
  const mo = m.goals.filter((g) => g.scope === "month");
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-extrabold"> اهداف هفتگی</h2>
      <div className="grid gap-3 sm:grid-cols-2">{WEEK_LABELS.map((l, i) => <Card key={l} title={l} scope="week" slot={i + 1} color="rgb(var(--plum))" list={wk(i + 1)} />)}</div>
      <h2 className="mb-3 mt-8 text-xl font-extrabold">اهداف  ماهانه</h2>
      <Card title="هدف‌های ماه" scope="month" slot={mo.filter((g) => g.slot === 1).length >= 10 ? 2 : 1} color="rgb(var(--brand))" list={mo} />
    </section>
  );
}
