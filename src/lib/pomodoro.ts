/** منطق تایمر پومودورو بدون وابستگی به React، تا بتوان آن را جداگانه آزمود */

export type Mode = "focus" | "short_break" | "long_break";
export const TIMES: Record<Mode, number> = { focus: 25 * 60, short_break: 5 * 60, long_break: 15 * 60 };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const ls = (): Store | null => {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

const dayKey = (day: string) => `pomodoro_${day}`;
const RUN_KEY = "pomodoro_run";
const isMode = (m: unknown): m is Mode => m === "focus" || m === "short_break" || m === "long_break";

export type DayStats = { minutes: number; rounds: number };

export function loadDay(day: string, store: Store | null = ls()): DayStats {
  try {
    const raw = store?.getItem(dayKey(day));
    if (raw) { const d = JSON.parse(raw); return { minutes: Number(d.minutes) || 0, rounds: Number(d.rounds) || 0 }; }
  } catch {}
  return { minutes: 0, rounds: 0 };
}

/**
 * پایان یک مرحله. اگر تمرکز بود یک دور به آمار امروز اضافه می‌شود.
 * آمار از حافظه خوانده می‌شود (نه از state)، تا مقدار قدیمی دور اضافه نشود.
 */
export function finishRound(mode: Mode, day: string, store: Store | null = ls()): DayStats & { next: Mode } {
  const cur = loadDay(day, store);
  if (mode !== "focus") return { ...cur, next: "focus" };
  const rounds = cur.rounds + 1, minutes = cur.minutes + TIMES.focus / 60;
  try { store?.setItem(dayKey(day), JSON.stringify({ minutes, rounds })); } catch {}
  return { rounds, minutes, next: rounds % 4 === 0 ? "long_break" : "short_break" };
}

/* ---------- تایمر در حال اجرا: اگر اپ بسته یا از حافظه پاک شود، ادامه پیدا می‌کند ---------- */
export type RunState = { mode: Mode; endAt: number };

export function saveRun(run: RunState, store: Store | null = ls()) {
  try { store?.setItem(RUN_KEY, JSON.stringify(run)); } catch {}
}
export function clearRun(store: Store | null = ls()) {
  try { store?.removeItem(RUN_KEY); } catch {}
}
export type LoadedRun = { kind: "none" } | { kind: "running"; mode: Mode; endAt: number } | { kind: "expired"; mode: Mode };

export function loadRun(now = Date.now(), store: Store | null = ls()): LoadedRun {
  try {
    const raw = store?.getItem(RUN_KEY);
    if (!raw) return { kind: "none" };
    const d = JSON.parse(raw);
    if (!isMode(d.mode) || !Number.isFinite(d.endAt)) { clearRun(store); return { kind: "none" }; }
    return d.endAt > now ? { kind: "running", mode: d.mode, endAt: d.endAt } : { kind: "expired", mode: d.mode };
  } catch {
    return { kind: "none" };
  }
}
