"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fa } from "@/lib/jalali";
import { CalendarBadge, pctText } from "@/components/ui";
import { toast, useMonth, useTodos } from "@/lib/data";
import { todayISO } from "@/lib/jalali";

type PomodoroMode = "focus" | "short_break" | "long_break";

const DEFAULT_TIMES = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

export default function PomodoroPage() {
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMES.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState(0); // تعداد جلسات تمرکز کامل‌شده
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [selectedTask, setSelectedTask] = useState("");

  const today = todayISO();
  const m = useMonth(Number(today.split("-")[0]), Number(today.split("-")[1]));
  const t = useTodos(today, today);

  const activeHabits = m.habits.filter((h) => !h.archived);
  const activeTodos = t.todos.filter((x) => !x.done);

  // لود آمار امروز از localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pomodoro_${today}`);
      if (raw) {
        const data = JSON.parse(raw);
        setTodayMinutes(data.minutes || 0);
        setRounds(data.rounds || 0);
      }
    } catch {}
  }, [today]);

  // پخش صدای زنگ با Web Audio API (بدون فایل صوتی خارجی)
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {}

    // لرزش گوشی برای بازخورد لمسی PWA
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  };

  // تایمر
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, rounds]);

  const handleComplete = () => {
    setIsRunning(false);
    playChime();

    if (mode === "focus") {
      const nextRounds = rounds + 1;
      setRounds(nextRounds);
      const addedMinutes = Math.round(DEFAULT_TIMES.focus / 60);
      const nextMinutes = todayMinutes + addedMinutes;
      setTodayMinutes(nextMinutes);

      try {
        localStorage.setItem(
          `pomodoro_${today}`,
          JSON.stringify({ minutes: nextMinutes, rounds: nextRounds })
        );
      } catch {}

      toast(`🎉 آفرین! یک دوره تمرکز ۲۵ دقیقه‌ای تکمیل شد.`);

      // هر ۴ پومودورو یک استراحت بلند
      if (nextRounds % 4 === 0) {
        setMode("long_break");
        setTimeLeft(DEFAULT_TIMES.long_break);
      } else {
        setMode("short_break");
        setTimeLeft(DEFAULT_TIMES.short_break);
      }
    } else {
      toast("☕ استراحت تمام شد؛ آماده برای تمرکز بعدی؟");
      setMode("focus");
      setTimeLeft(DEFAULT_TIMES.focus);
    }
  };

  const switchMode = (newMode: PomodoroMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(DEFAULT_TIMES[newMode]);
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(DEFAULT_TIMES[mode]);
  };

  const skipNext = () => {
    setIsRunning(false);
    if (mode === "focus") {
      setMode("short_break");
      setTimeLeft(DEFAULT_TIMES.short_break);
    } else {
      setMode("focus");
      setTimeLeft(DEFAULT_TIMES.focus);
    }
  };

  const totalTime = DEFAULT_TIMES[mode];
  const progress = (totalTime - timeLeft) / totalTime;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // تنظیم اندازه و محیط حلقه
  const size = 240;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  const modeColors = {
    focus: "rgb(var(--brand))",
    short_break: "rgb(var(--mint))",
    long_break: "rgb(var(--plum))",
  };

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">تایمر تمرکز (پومودورو)</h1>
          <p className="text-sm text-mute">بهره‌وری بالا با چرخه‌های ۲۵ دقیقه‌ای</p>
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

      {/* انتخاب حالت: تمرکز / استراحت */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-surface p-1 shadow-card">
        <button
          type="button"
          onClick={() => switchMode("focus")}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
            mode === "focus"
              ? "bg-brand text-white shadow-card"
              : "text-mute hover:text-ink"
          }`}
        >
          🎯 تمرکز (۲۵ د)
        </button>
        <button
          type="button"
          onClick={() => switchMode("short_break")}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
            mode === "short_break"
              ? "bg-mint text-white shadow-card"
              : "text-mute hover:text-ink"
          }`}
        >
          ☕ استراحت (۵ د)
        </button>
        <button
          type="button"
          onClick={() => switchMode("long_break")}
          className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
            mode === "long_break"
              ? "bg-plum text-white shadow-card"
              : "text-mute hover:text-ink"
          }`}
        >
          🌴 استراحت بلند (۱۵ د)
        </button>
      </div>

      {/* تایمر دایره‌ای با شمارش معکوس بزرگ */}
      <section className="relative flex flex-col items-center justify-center rounded-hero bg-surface p-8 shadow-card">
        <div className="relative grid place-items-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* دایره پس‌زمینه */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgb(var(--soft))"
              strokeWidth={stroke}
            />
            {/* دایره پیشرفت فعال */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={modeColors[mode]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
            />
          </svg>

          {/* متن وسط حلقه */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              dir="ltr"
              className="font-mono text-5xl font-extrabold tracking-tight text-ink select-none"
            >
              {fa(timeFormatted)}
            </span>
            <span className="mt-1 text-xs font-bold text-mute">
              {mode === "focus"
                ? isRunning
                  ? "در حال تمرکز عمیق…"
                  : "آماده برای شروع"
                : "زمان تجدید انرژی"}
            </span>

            {/* نشانگر دور پومودورو (۴ دایره) */}
            <div className="mt-3 flex items-center gap-1.5">
              {[1, 2, 3, 4].map((i) => {
                const filled = (rounds % 4) >= i || (rounds > 0 && rounds % 4 === 0);
                return (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      filled ? "bg-brand" : "bg-soft"
                    }`}
                  />
                );
              })}
            </div>
            <span className="mt-1 text-[11px] font-semibold text-mute">
              دور {fa((rounds % 4) + 1)} از {fa(4)}
            </span>
          </div>
        </div>

        {/* دکمه‌های کنترل تایمر — بهینه شده برای لمس موبایل */}
        <div className="mt-8 flex items-center justify-center gap-5">
          {/* دکمه بازنشانی */}
          <button
            type="button"
            onClick={resetTimer}
            aria-label="شروع مجدد تایمر"
            title="بازنشانی تایمر"
            className="grid h-12 w-12 place-items-center rounded-2xl bg-soft text-lg font-bold text-mute active:scale-90 transition-transform"
          >
            ↺
          </button>

          {/* دکمه بزرگ شروع / توقف */}
          <button
            type="button"
            onClick={toggleTimer}
            aria-label={isRunning ? "توقف موقت" : "شروع تمرکز"}
            className="flex h-16 min-w-36 items-center justify-center gap-2 rounded-full px-6 text-base font-extrabold text-white shadow-pop active:scale-95 transition-transform"
            style={{ background: modeColors[mode] }}
          >
            {isRunning ? (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="2" />
                  <rect x="14" y="4" width="4" height="16" rx="2" />
                </svg>
                <span>توقف</span>
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 4.5v15a1 1 0 001.5.86l13-7.5a1 1 0 000-1.72l-13-7.5A1 1 0 005 4.5z" />
                </svg>
                <span>شروع</span>
              </>
            )}
          </button>

          {/* دکمه رفتن به مرحله بعد */}
          <button
            type="button"
            onClick={skipNext}
            aria-label="رفتن به مرحله بعد"
            title="پرش به دور بعد"
            className="grid h-12 w-12 place-items-center rounded-2xl bg-soft text-lg font-bold text-mute active:scale-90 transition-transform"
          >
            ⏭
          </button>
        </div>

        {/* انتخاب عادت یا کار برای تمرکز */}
        <div className="mt-6 w-full max-w-sm border-t border-line/60 pt-4 text-center">
          <label className="mb-2 block text-xs font-bold text-mute">
            تمرکز روی چه کاری است؟
          </label>
          <div className="flex gap-2">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand"
            >
              <option value="">(بدون عنوان خاص)</option>
              {activeHabits.map((h) => (
                <option key={h.id} value={`عادت: ${h.name.trim()}`}>
                  🎯 عادت: {h.name.trim()}
                </option>
              ))}
              {activeTodos.map((x) => (
                <option key={x.id} value={`کار: ${x.title.trim()}`}>
                  📝 کار: {x.title.trim()}
                </option>
              ))}
            </select>
          </div>
          {selectedTask && (
            <p className="mt-2 text-xs font-bold text-brand">
              🎯 تمرکز فعلی: {selectedTask}
            </p>
          )}
        </div>
      </section>

      {/* آمار امروز */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-hero bg-surface p-4 shadow-card">
          <span className="text-xs font-semibold text-mute">جلسات کامل‌شده امروز</span>
          <p className="mt-1 text-3xl font-extrabold text-ink">{fa(rounds)}</p>
          <span className="text-[11px] font-semibold text-mute">دور پومودورو</span>
        </div>

        <div className="rounded-hero bg-surface p-4 shadow-card">
          <span className="text-xs font-semibold text-mute">مجموع تمرکز امروز</span>
          <p className="mt-1 text-3xl font-extrabold text-brand">{fa(todayMinutes)}</p>
          <span className="text-[11px] font-semibold text-mute">دقیقه تمرکز عمیق</span>
        </div>
      </section>

      {/* راهنمای سریع روش پومودورو */}
      <section className="mt-4 rounded-hero bg-surface p-4 shadow-card">
        <h3 className="mb-2 text-sm font-extrabold text-ink">قانون تکنیک پومودورو</h3>
        <p className="text-xs leading-6 text-mute">
          ۱. ۲۵ دقیقه بدون حواس‌پرتی و با تمرکز کامل روی کار مورد نظر کار کنید.
          <br />
          ۲. بعد از زنگ، ۵ دقیقه استراحت کوتاه داشته باشید (بلند شوید و آب بنوشید).
          <br />
          ۳. بعد از هر ۴ دور تمرکز، یک استراحت بلند ۱۵ دقیقه‌ای نوش جان کنید!
        </p>
      </section>
    </main>
  );
}
