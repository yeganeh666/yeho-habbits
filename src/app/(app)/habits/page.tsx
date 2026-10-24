"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, fa, fromISO, monthLength, MONTHS, shiftMonth, toISO, todayISO, WEEKDAYS_SHORT, weekdayIndex, WEEK_LABELS, weekOfDay, weekStartISO } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { Bar, Check, CalendarBadge, Donut, pctText, Sheet } from "@/components/ui";
import { HabitSheet } from "@/components/habit-sheet";
import type { Habit } from "@/lib/types";

type M = ReturnType<typeof useMonth>;
const Chevron = ({ dir }: { dir: "l" | "r" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={dir === "r" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} /></svg>
);
const Tick = ({ size = 16 }: { size?: number }) => (
  <svg className="pop" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const QUICK = ["نوشیدن آب", "مطالعه", "ورزش", "مدیتیشن"];

export default function HabitsMonth() {
  const now = fromISO(todayISO());
  const today = todayISO();
  const [ym, setYm] = useState({ jy: now.jy, jm: now.jm });
  const m = useMonth(ym.jy, ym.jm);
  const [edit, setEdit] = useState<Habit | null>(null);
  const [preset, setPreset] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");
  useEffect(() => { try { const v = localStorage.getItem("habits_view"); if (v === "table" || v === "cards") setView(v); } catch {} }, []);
  const pick = (v: "cards" | "table") => { setView(v); try { localStorage.setItem("habits_view", v); } catch {} };

  const len = monthLength(ym.jy, ym.jm);
  const isCurrent = ym.jy === now.jy && ym.jm === now.jm;
  const iso = (d: number) => toISO({ ...ym, jd: d });
  const habits = m.habits;
  const active = habits.filter((h) => !h.archived);
  const totalDone = habits.reduce((s, h) => s + m.countOf(h.id), 0);
  const totalTarget = habits.reduce((s, h) => s + m.targetOf(h), 0);
  const pct = totalTarget ? totalDone / totalTarget : 0;
  const todayDone = isCurrent ? active.filter((h) => m.isDone(h.id, today)).length : 0;
  const upTo = isCurrent ? now.jd : ym.jy * 12 + ym.jm < now.jy * 12 + now.jm ? len : 0;

  const streakOf = (h: Habit) => { let s = 0; for (let d = upTo; d >= 1; d--) { if (m.isDone(h.id, iso(d))) s++; else if (d !== upTo) break; } return s; };
  const openNew = (name = "") => { setEdit(null); setPreset(name); setOpen(true); };
  const openEdit = (h: Habit) => { setEdit(h); setPreset(""); setOpen(true); };
  const detailHabit = habits.find((h) => h.id === detail) ?? null;

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button aria-label="ماه قبل" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card active:scale-95" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, -1))}><Chevron dir="r" /></button>
          <h1 className="min-w-32 text-center text-xl font-extrabold">{MONTHS[ym.jm - 1]} {fa(ym.jy)}</h1>
          <button aria-label="ماه بعد" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card active:scale-95" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, 1))}><Chevron dir="l" /></button>
        </div>
        <div className="flex items-center gap-2">
          <CalendarBadge />
          <Link href="/settings" aria-label="تنظیمات" className="grid h-8 w-8 place-items-center rounded-full bg-surface text-sm text-mute shadow-card transition-transform hover:text-ink active:scale-95">⚙️</Link>
        </div>
      </header>

      {/* خلاصهٔ ماه */}
      <section className="relative overflow-hidden rounded-hero p-5 text-white shadow-card" style={{ background: "linear-gradient(135deg, #2A1B8C 0%, rgb(var(--brand)) 100%)" }}>
        <div aria-hidden className="absolute -start-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-5">
          <Donut pct={pct} color="#fff" size={96} stroke={11}><span className="text-xl font-extrabold">{pctText(pct)}</span></Donut>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/75">پیشرفت ماه</p>
            <p className="text-lg font-extrabold leading-snug">{fa(totalDone)} از {fa(totalTarget)} تیک هدف</p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-semibold">
              {isCurrent && active.length > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">امروز: {fa(todayDone)}/{fa(active.length)}</span>}
              {isCurrent && <span className="rounded-full bg-white/15 px-2.5 py-1">{fa(len - now.jd)} روز تا پایان ماه</span>}
            </div>
          </div>
        </div>
      </section>

      {/* نوار ابزار */}
      <div className="mb-3 mt-6 flex items-center justify-between gap-3">
        <div role="tablist" aria-label="نوع نمایش" className="flex rounded-2xl bg-soft p-1">
          {([["cards", "کارت‌ها"], ["table", "جدول"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => pick(k)} className={`rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${view === k ? "bg-surface text-brand shadow-card" : "text-mute"}`}>{l}</button>
          ))}
        </div>
        <button onClick={() => openNew()} className="flex items-center gap-1.5 rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-card active:scale-95"><span className="text-lg leading-none">+</span> عادت جدید</button>
      </div>

      {m.loading ? (
        <ul className="space-y-3" aria-busy>{[0, 1, 2].map((i) => <li key={i} className="h-36 animate-pulse rounded-hero bg-surface/70" />)}</ul>
      ) : habits.length === 0 ? (
        <Empty onPick={openNew} />
      ) : view === "cards" ? (
        <ul className="space-y-3">
          {habits.map((h) => <HabitCard key={h.id} h={h} m={m} ym={ym} len={len} isCurrent={isCurrent} streak={streakOf(h)} onOpen={() => setDetail(h.id)} onEdit={() => openEdit(h)} />)}
        </ul>
      ) : (
        <TableView m={m} ym={ym} len={len} iso={iso} today={today} active={active} onEdit={openEdit} />
      )}

      <Goals m={m} defaultWeek={isCurrent ? weekOfDay(now.jd) : 1} />

      <DetailSheet h={detailHabit} onClose={() => setDetail(null)} m={m} ym={ym} len={len} iso={iso} today={today} streak={detailHabit ? streakOf(detailHabit) : 0}
        onEdit={() => { if (detailHabit) { const h = detailHabit; setDetail(null); openEdit(h); } }} />

      <HabitSheet open={open} onClose={() => setOpen(false)} habit={edit} monthLen={len} presetName={preset} defaultTarget={edit ? m.targetOf(edit) : len}
        onSave={async (v) => { edit ? await m.updateHabit(edit.id, { name: v.name, color: v.color, ...(v.isPrivate !== !!edit.is_private ? { is_private: v.isPrivate } : {}) }, v.target) : await m.addHabit({ name: v.name, target: v.target, color: v.color, is_private: v.isPrivate }); }}
        onArchive={edit ? async () => { await m.updateHabit(edit.id, { archived: true }); } : undefined} />
    </main>
  );
}

/* ---------- حالت خالی ---------- */
function Empty({ onPick }: { onPick: (name?: string) => void }) {
  return (
    <div className="rounded-hero border-2 border-dashed border-line bg-surface/60 p-7 text-center">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-soft text-3xl">🌱</div>
      <h2 className="text-lg font-extrabold">اولین عادتت را بساز</h2>
      <p className="mx-auto mt-1 max-w-64 text-sm text-mute">با یک عادت کوچک شروع کن؛ هر روز یک تیک.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {QUICK.map((q) => <button key={q} onClick={() => onPick(q)} className="rounded-full bg-soft px-4 py-2 text-sm font-semibold text-brand active:scale-95">{q}</button>)}
      </div>
      <button onClick={() => onPick()} className="mt-4 text-sm font-bold text-brand">یا نام دلخواه بنویس</button>
    </div>
  );
}

/* ---------- کارت عادت: هفتهٔ جاری + پیشرفت ماه ---------- */
function HabitCard({ h, m, ym, len, isCurrent, streak, onOpen, onEdit }: { h: Habit; m: M; ym: { jy: number; jm: number }; len: number; isCurrent: boolean; streak: number; onOpen: () => void; onEdit: () => void }) {
  const today = todayISO();
  const c = m.countOf(h.id), tg = m.targetOf(h), p = tg ? c / tg : 0;
  const start = weekStartISO(isCurrent ? today : toISO({ ...ym, jd: 1 }));
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <li className="rounded-hero bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} aria-label={`جزئیات ${h.name.trim()}`} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <Donut pct={p} size={52} stroke={6} color={h.color}><span className="text-[11px] font-extrabold">{pctText(p)}</span></Donut>
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold">{h.name.trim()}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-mute">
              <span>{fa(c)} از {fa(tg)} روز</span>
              {streak > 1 && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${h.color}22`, color: h.color }}>🔥 {fa(streak)} روز پیاپی</span>}
            </span>
          </span>
        </button>
        <button onClick={onEdit} aria-label={`ویرایش ${h.name.trim()}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-mute active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
        </button>
      </div>
      <div className="mt-3.5 grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const q = fromISO(d), inMonth = q.jy === ym.jy && q.jm === ym.jm, on = inMonth && m.isDone(h.id, d), isToday = d === today;
          return (
            <button key={d} disabled={!inMonth} onClick={() => m.toggle(h, d)} aria-pressed={on} aria-label={`${h.name.trim()} ${fa(q.jd)} ${MONTHS[q.jm - 1]}`}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-all active:scale-90 disabled:opacity-30 ${on ? "" : "bg-bg"}`}
              style={{ background: on ? h.color : undefined, boxShadow: isToday && !on ? `inset 0 0 0 2px ${h.color}` : undefined }}>
              <span className={`text-[10px] font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[i]}</span>
              {on ? <Tick size={18} /> : <span className="text-sm font-extrabold leading-[18px]">{fa(q.jd)}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onOpen} className="mt-2.5 w-full text-center text-xs font-bold text-mute">مشاهدهٔ تقویم کامل ماه ‹</button>
    </li>
  );
}

/* ---------- جزئیات: تقویم کامل ماه برای یک عادت ---------- */
function DetailSheet({ h, onClose, m, ym, len, iso, today, streak, onEdit }: { h: Habit | null; onClose: () => void; m: M; ym: { jy: number; jm: number }; len: number; iso: (d: number) => string; today: string; streak: number; onEdit: () => void }) {
  if (!h) return null;
  const c = m.countOf(h.id), tg = m.targetOf(h), offset = weekdayIndex(iso(1));
  return (
    <Sheet open onClose={onClose} title={h.name.trim()}>
      <div className="mb-5 grid grid-cols-3 gap-2.5 text-center">
        {[[fa(c), "انجام‌شده"], [pctText(tg ? c / tg : 0), "از هدف"], [fa(streak), "روز پیاپی"]].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-bg py-3"><div className="text-xl font-extrabold" style={{ color: h.color }}>{v}</div><div className="text-[11px] font-semibold text-mute">{l}</div></div>
        ))}
      </div>
      <p className="mb-2 text-sm font-bold text-mute">{MONTHS[ym.jm - 1]} {fa(ym.jy)} · روی هر روز بزن</p>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center">{WEEKDAYS_SHORT.map((w) => <span key={w} className="text-[11px] font-semibold text-mute">{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
        {Array.from({ length: len }, (_, i) => i + 1).map((d) => {
          const on = m.isDone(h.id, iso(d)), isToday = iso(d) === today;
          return (
            <button key={d} onClick={() => m.toggle(h, iso(d))} aria-pressed={on} aria-label={`روز ${fa(d)}`}
              className={`grid aspect-square place-items-center rounded-xl text-sm font-bold transition-all active:scale-90 ${on ? "text-white" : "bg-bg"}`}
              style={{ background: on ? h.color : undefined, boxShadow: isToday && !on ? `inset 0 0 0 2px ${h.color}` : undefined }}>
              {on ? <Tick size={16} /> : fa(d)}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={onEdit} className="flex-1 rounded-2xl bg-soft py-3.5 font-bold text-brand active:scale-[.98]">ویرایش عادت</button>
        <button onClick={onClose} className="rounded-2xl bg-bg px-6 py-3.5 font-bold text-mute active:scale-[.98]">بستن</button>
      </div>
    </Sheet>
  );
}

/* ---------- نمای جدولی (مثل شیت) ---------- */
function TableView({ m, ym, len, iso, today, active, onEdit }: { m: M; ym: { jy: number; jm: number }; len: number; iso: (d: number) => string; today: string; active: Habit[]; onEdit: (h: Habit) => void }) {
  const days = Array.from({ length: len }, (_, i) => i + 1);
  const dayDone = (d: number) => active.filter((h) => m.isDone(h.id, iso(d))).length;
  return (
    <section aria-label="جدول عادت‌های ماه" className="overflow-hidden rounded-hero bg-surface shadow-card">
      <p className="px-4 pt-3 text-xs font-semibold text-mute">برای دیدن همهٔ روزها به کنار بکش ›</p>
      <div className="no-scrollbar overflow-x-auto">
        <table className="border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 min-w-36 bg-surface p-3 text-start text-sm font-bold text-mute">عادت</th>
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
            {m.habits.map((h) => (
              <tr key={h.id}>
                <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start">
                  <button className="block w-full text-start" onClick={() => onEdit(h)}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} /><span className="max-w-28 truncate text-sm font-bold">{h.name.trim()}</span></span>
                    <span className="mt-1.5 flex items-center gap-2"><span className="w-12"><Bar value={m.countOf(h.id)} max={m.targetOf(h)} color={h.color} /></span><span className="text-[11px] font-semibold text-mute">{fa(m.countOf(h.id))}/{fa(m.targetOf(h))}</span></span>
                  </button>
                </th>
                {days.map((d) => {
                  const on = m.isDone(h.id, iso(d));
                  return (
                    <td key={d} className={`p-0.5 ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
                      <button aria-label={`${h.name.trim()} روز ${fa(d)}`} aria-pressed={on} onClick={() => m.toggle(h, iso(d))} className="mx-auto grid h-8 w-8 place-items-center rounded-[10px] transition-colors" style={{ background: on ? h.color : "rgb(var(--soft))" }}>{on && <Tick />}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start text-sm font-bold text-mute">پیشرفت روز</th>
              {days.map((d) => {
                const p = active.length ? dayDone(d) / active.length : 0;
                return <td key={d} className={`px-0.5 pb-3 pt-2 align-bottom ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}><div title={pctText(p)} className="mx-auto flex h-14 w-8 items-end overflow-hidden rounded-lg bg-soft"><div className="w-full rounded-lg bg-mint transition-[height]" style={{ height: `${p * 100}%` }} /></div></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- اهداف: هفته‌ها با تب، ماه جدا ---------- */
function Goals({ m, defaultWeek }: { m: M; defaultWeek: number }) {
  const [week, setWeek] = useState(defaultWeek);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const add = async (scope: "week" | "month", slot: number, key: string) => { const t = (draft[key] ?? "").trim(); if (!t) return; setDraft((p) => ({ ...p, [key]: "" })); await m.addGoal(scope, slot, t); };
  const Card = ({ title, scope, slot, color, list }: { title: string; scope: "week" | "month"; slot: number; color: string; list: typeof m.goals }) => {
    const key = `${scope}${slot}`, done = list.filter((g) => g.done).length;
    return (
      <div className="rounded-hero bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold">{title}</h3><span className="text-xs font-bold text-mute">{fa(done)}/{fa(list.length)}</span></div>
        <Bar value={done} max={list.length} color={color} />
        {list.length === 0 && <p className="mt-4 text-center text-sm text-mute">هنوز هدفی ننوشتی</p>}
        <ul className="mt-3 space-y-2">
          {list.map((g) => (
            <li key={g.id} className="flex items-center gap-3">
              <Check on={g.done} size={26} color={color} label={g.title} onClick={() => m.toggleGoal(g)} />
              <span className={`flex-1 text-sm ${g.done ? "text-mute line-through" : "font-semibold"}`}>{g.title.trim()}</span>
              <button aria-label={`حذف ${g.title}`} className="grid h-8 w-8 place-items-center rounded-full text-mute opacity-60 hover:opacity-100" onClick={() => m.removeGoal(g)}>✕</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(scope, slot, key); }}>
          <input value={draft[key] ?? ""} onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))} placeholder="هدف جدید…" className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
          <button className="rounded-xl bg-soft px-4 text-sm font-bold text-brand">افزودن</button>
        </form>
      </div>
    );
  };
  const wk = (s: number) => m.goals.filter((g) => g.scope === "week" && g.slot === s);
  const mo = m.goals.filter((g) => g.scope === "month");
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-xl font-extrabold">اهداف هفتگی</h2>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto" role="tablist">
        {WEEK_LABELS.map((l, i) => {
          const n = wk(i + 1), d = n.filter((g) => g.done).length;
          return (
            <button key={l} role="tab" aria-selected={week === i + 1} onClick={() => setWeek(i + 1)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${week === i + 1 ? "bg-plum text-white" : "bg-surface text-mute shadow-card"}`}>
              {l.replace("هفته ", "")}{n.length > 0 && <span className="ms-1.5 text-[11px] opacity-80">{fa(d)}/{fa(n.length)}</span>}
            </button>
          );
        })}
      </div>
      <Card title={WEEK_LABELS[week - 1]} scope="week" slot={week} color="rgb(var(--plum))" list={wk(week)} />
      <h2 className="mb-3 mt-8 text-xl font-extrabold">اهداف ماهانه</h2>
      <Card title="هدف‌های ماه" scope="month" slot={mo.filter((g) => g.slot === 1).length >= 10 ? 2 : 1} color="rgb(var(--brand))" list={mo} />
    </section>
  );
}
