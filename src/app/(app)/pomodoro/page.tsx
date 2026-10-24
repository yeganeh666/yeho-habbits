"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fa, todayISO } from "@/lib/jalali";
import { CalendarBadge } from "@/components/ui";
import { toast, useMonth, useTodos } from "@/lib/data";

type Mode = "focus" | "short_break" | "long_break";
const TIMES: Record<Mode, number> = { focus: 25 * 60, short_break: 5 * 60, long_break: 15 * 60 };
const MODES: { key: Mode; label: string; min: number; color: string }[] = [
  { key: "focus", label: "تمرکز", min: 25, color: "rgb(var(--brand))" },
  { key: "short_break", label: "استراحت کوتاه", min: 5, color: "rgb(var(--mint))" },
  { key: "long_break", label: "استراحت بلند", min: 15, color: "rgb(var(--plum))" },
];
const DAILY_GOAL = 4;

const Icon = ({ d, size = 22, fill = false }: { d: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);

export default function PomodoroPage() {
  const today = todayISO();
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(TIMES.focus);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [minutesToday, setMinutesToday] = useState(0);
  const [task, setTask] = useState("");
  const endAt = useRef<number | null>(null);

  const m = useMonth(+today.split("-")[0], +today.split("-")[1]);
  const t = useTodos(today, today);
  const habits = m.habits.filter((h) => !h.archived);
  const todos = t.todos.filter((x) => !x.done);
  const cur = MODES.find((x) => x.key === mode)!;

  useEffect(() => {
    try { const raw = localStorage.getItem(`pomodoro_${today}`); if (raw) { const d = JSON.parse(raw); setMinutesToday(d.minutes || 0); setRounds(d.rounds || 0); } } catch {}
  }, [today]);

  const chime = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(587.33, ctx.currentTime); osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.7);
    } catch {}
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
  };

  const goTo = (next: Mode) => { setRunning(false); endAt.current = null; setMode(next); setTimeLeft(TIMES[next]); };

  const complete = () => {
    setRunning(false); endAt.current = null; chime();
    if (mode === "focus") {
      const nr = rounds + 1, nm = minutesToday + TIMES.focus / 60;
      setRounds(nr); setMinutesToday(nm);
      try { localStorage.setItem(`pomodoro_${today}`, JSON.stringify({ minutes: nm, rounds: nr })); } catch {}
      toast("🎉 آفرین! یک دورهٔ تمرکز ۲۵ دقیقه‌ای تمام شد");
      goTo(nr % 4 === 0 ? "long_break" : "short_break");
    } else { toast("☕ استراحت تمام شد؛ آماده‌ای برای دور بعد؟"); goTo("focus"); }
  };
  const completeRef = useRef(complete); completeRef.current = complete;

  // تایمر بر پایهٔ زمان پایان، تا با رفتن به پس‌زمینه عقب نیفتد
  useEffect(() => {
    if (!running) return;
    if (endAt.current === null) endAt.current = Date.now() + timeLeft * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt.current! - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) { clearInterval(id); completeRef.current(); }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0"), ss = String(timeLeft % 60).padStart(2, "0");
  useEffect(() => {
    document.title = running ? `${fa(mm)}:${fa(ss)} · ${cur.label}` : "عادت‌ها";
    return () => { document.title = "عادت‌ها"; };
  }, [running, mm, ss, cur.label]);

  const toggle = () => { if (running) { setRunning(false); endAt.current = null; } else setRunning(true); };
  const reset = () => { setRunning(false); endAt.current = null; setTimeLeft(TIMES[mode]); };
  const skip = () => goTo(mode === "focus" ? "short_break" : "focus");

  const size = 264, stroke = 16, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const progress = (TIMES[mode] - timeLeft) / TIMES[mode];
  const cycle = rounds % 4;
  const goalPct = Math.min(1, rounds / DAILY_GOAL);

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">تمرکز</h1>
          <p className="text-sm text-mute">دورهٔ ۲۵ دقیقه‌ای، بدون حواس‌پرتی</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarBadge />
          <Link href="/settings" aria-label="تنظیمات" className="grid h-8 w-8 place-items-center rounded-full bg-surface text-sm text-mute shadow-card transition-transform hover:text-ink active:scale-95">⚙️</Link>
        </div>
      </header>

      {/* انتخاب حالت */}
      <div role="tablist" aria-label="حالت تایمر" className="mb-4 grid grid-cols-3 gap-1 rounded-3xl bg-surface p-1.5 shadow-card">
        {MODES.map((x) => {
          const on = mode === x.key;
          return (
            <button key={x.key} role="tab" aria-selected={on} onClick={() => goTo(x.key)}
              className={`flex flex-col items-center rounded-2xl px-1 py-2 transition-all active:scale-95 ${on ? "text-white shadow-card" : "text-mute"}`} style={{ background: on ? x.color : undefined }}>
              <span className="text-sm font-extrabold leading-tight">{x.label}</span>
              <span className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-mute/80"}`}>{fa(x.min)} دقیقه</span>
            </button>
          );
        })}
      </div>

      {/* تایمر */}
      <section className="relative overflow-hidden rounded-hero bg-surface px-5 pb-7 pt-8 shadow-card">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-4 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-3xl transition-colors duration-500" style={{ background: cur.color }} />
        <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--soft))" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cur.color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset .4s linear, stroke .4s" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div role="timer" aria-live="off" dir="ltr" className="select-none text-[3.6rem] font-extrabold leading-none tracking-tight text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fa(mm)}:{fa(ss)}
            </div>
            <p className="mt-2 text-sm font-bold text-mute">{running ? (mode === "focus" ? "در حال تمرکز…" : "در حال استراحت…") : mode === "focus" ? "آمادهٔ شروع" : "وقت تجدید قوا"}</p>
          </div>
        </div>

        {/* ۴ دور چرخه */}
        <div className="relative mt-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2" aria-label={`دور ${fa(cycle + 1)} از ۴`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className="h-2.5 rounded-full transition-all" style={{ width: i === cycle && mode === "focus" ? 28 : 10, background: i < cycle ? "rgb(var(--brand))" : i === cycle && mode === "focus" ? "rgb(var(--brand) / .45)" : "rgb(var(--soft))" }} />)}
          </div>
          <span className="text-xs font-semibold text-mute">دور {fa(cycle + 1)} از {fa(4)}</span>
        </div>

        {/* کنترل‌ها */}
        <div className="relative mt-6 flex items-center justify-center gap-6">
          <button onClick={reset} aria-label="شروع دوباره" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-soft text-mute transition-transform active:scale-90"><Icon d="M3 12a9 9 0 109-9 9 9 0 00-6.7 3L3 8M3 3v5h5" /></button>
          <button onClick={toggle} aria-label={running ? "توقف موقت" : "شروع"} className="grid h-20 w-20 place-items-center rounded-full text-white shadow-pop transition-transform active:scale-95" style={{ background: cur.color }}>
            {running ? <Icon size={30} fill d="M7 4h3v16H7zM14 4h3v16h-3z" /> : <Icon size={30} fill d="M7 4.5v15l12.5-7.5z" />}
          </button>
          <button onClick={skip} aria-label="رد کردن این مرحله" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-soft text-mute transition-transform active:scale-90"><Icon d="M5 5l9 7-9 7zM19 5v14" /></button>
        </div>
      </section>

      {/* موضوع تمرکز */}
      <section className="mt-4 rounded-hero bg-surface p-4 shadow-card">
        <label htmlFor="focus-task" className="mb-2 block text-sm font-bold">روی چه چیزی تمرکز می‌کنی؟</label>
        <div className="relative">
          <select id="focus-task" value={task} onChange={(e) => setTask(e.target.value)} className="w-full appearance-none rounded-2xl border border-line bg-bg py-3 pe-10 ps-4 text-sm font-semibold outline-none focus:border-brand">
            <option value="">بدون موضوع خاص</option>
            {habits.length > 0 && <optgroup label="عادت‌ها">{habits.map((h) => <option key={h.id} value={h.name.trim()}>{h.name.trim()}</option>)}</optgroup>}
            {todos.length > 0 && <optgroup label="کارهای امروز">{todos.map((x) => <option key={x.id} value={x.title.trim()}>{x.title.trim()}</option>)}</optgroup>}
          </select>
          <svg className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
        </div>
        {task && <p className="mt-2.5 truncate text-sm font-bold" style={{ color: cur.color }}>● {task}</p>}
      </section>

      {/* آمار امروز */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-hero bg-surface p-4 shadow-card">
          <p className="text-sm font-semibold text-mute">دورهای امروز</p>
          <p className="mt-1 text-3xl font-extrabold">{fa(rounds)}<span className="ms-1 text-base font-bold text-mute">/ {fa(DAILY_GOAL)}</span></p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${goalPct * 100}%` }} /></div>
        </div>
        <div className="rounded-hero bg-surface p-4 shadow-card">
          <p className="text-sm font-semibold text-mute">زمان تمرکز</p>
          <p className="mt-1 text-3xl font-extrabold text-brand">{fa(minutesToday)}<span className="ms-1 text-base font-bold text-mute">دقیقه</span></p>
          <p className="mt-2 text-xs font-semibold text-mute">{minutesToday >= 60 ? `حدود ${fa(Math.round((minutesToday / 60) * 10) / 10)} ساعت` : "هر دور ۲۵ دقیقه"}</p>
        </div>
      </section>

      <details className="group mt-4 rounded-hero bg-surface p-4 shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-extrabold">روش پومودورو چطور کار می‌کند؟<span className="text-mute transition-transform group-open:rotate-180">⌄</span></summary>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm leading-7 text-mute">
          <li>۲۵ دقیقه با تمرکز کامل روی یک کار بمان.</li>
          <li>بعد از زنگ، ۵ دقیقه استراحت کن؛ بلند شو و آب بنوش.</li>
          <li>بعد از هر ۴ دور، یک استراحت بلند ۱۵ دقیقه‌ای داشته باش.</li>
        </ol>
      </details>
    </main>
  );
}
