import { addDays, fa, fromISO, isoInTehran, monthLength, MONTHS, WEEKDAYS_SHORT, weekdayIndex, weekStartISO, toISO } from "./jalali";

/**
 * قاعدهٔ تکرار عادت (شبیه «Custom recurrence» در تقویم گوگل).
 * روزهای هفته: ۰ = شنبه … ۶ = جمعه
 */
export type Recurrence = {
  unit: "day" | "week" | "month";
  /** هر چند واحد یک‌بار (≥ ۱) */
  interval: number;
  /** فقط برای unit = week */
  days?: number[];
  /** تاریخ شروع (ISO میلادی) */
  start: string;
  end?: { type: "never" } | { type: "on"; date: string } | { type: "after"; count: number };
};

/** حداقل فیلدهای لازم از عادت برای محاسبهٔ برنامه */
export type Schedulable = { recurrence?: Recurrence | null; created_at?: string };

/** تکرار پیش‌فرض: هر روز، از تاریخ داده‌شده */
export const dailyRecurrence = (start: string): Recurrence => ({ unit: "day", interval: 1, start, end: { type: "never" } });

const createdDayCache = new Map<string, string>();
/**
 * اولین روزی که عادت «نوبت» دارد: برای عادت دارای تکرار همان start،
 * برای عادت‌های قدیمی (بدون تکرار) روز ساخته‌شدن عادت؛ null یعنی نامشخص.
 */
export function startOf(h: Schedulable): string | null {
  if (h.recurrence) return h.recurrence.start;
  if (!h.created_at) return null;
  let d = createdDayCache.get(h.created_at);
  if (!d) { d = isoInTehran(h.created_at); createdDayCache.set(h.created_at, d); }
  return d;
}

const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/** آیا این روز طبق الگوی تکرار (بدون در نظر گرفتن پایان) یک نوبت است؟ */
function matches(r: Recurrence, iso: string): boolean {
  const k = daysBetween(r.start, iso);
  if (k < 0) return false;
  const n = Math.max(1, r.interval || 1);
  if (r.unit === "day") return k % n === 0;
  if (r.unit === "week") {
    const weeks = daysBetween(weekStartISO(r.start), weekStartISO(iso)) / 7;
    if (weeks % n !== 0) return false;
    const days = r.days?.length ? r.days : [weekdayIndex(r.start)];
    return days.includes(weekdayIndex(iso));
  }
  const a = fromISO(r.start), b = fromISO(iso);
  const diff = (b.jy - a.jy) * 12 + (b.jm - a.jm);
  if (diff < 0 || diff % n !== 0) return false;
  return b.jd === Math.min(a.jd, monthLength(b.jy, b.jm));
}

/** بیشترین بازهٔ جست‌وجو برای پیدا کردن آخرین نوبتِ «بعد از N بار» (۳۰ سال) */
const MAX_SPAN = 366 * 30;
const lastCache = new WeakMap<Recurrence, string>();
/** تاریخ آخرین نوبت وقتی پایان «بعد از N بار» است (یک‌بار محاسبه و ذخیره می‌شود) */
function lastOccurrence(r: Recurrence, count: number): string {
  let v = lastCache.get(r);
  if (v) return v;
  let c = 0;
  v = addDays(r.start, MAX_SPAN);
  for (let i = 0; i <= MAX_SPAN; i++) {
    const d = addDays(r.start, i);
    if (matches(r, d) && ++c >= Math.max(1, count)) { v = d; break; }
  }
  lastCache.set(r, v);
  return v;
}

/** آیا این عادت در این روز باید انجام شود؟ (عادت بدون تکرار = هر روز، از روز ساخته‌شدن) */
export function isDue(h: Schedulable, iso: string): boolean {
  const r = h.recurrence;
  if (!r) {
    const s = startOf(h);
    return !s || iso >= s;
  }
  if (iso < r.start) return false;
  const end = r.end;
  if (end?.type === "on" && iso > end.date) return false;
  if (!matches(r, iso)) return false;
  if (end?.type === "after" && iso > lastOccurrence(r, end.count)) return false;
  return true;
}

/** تعداد نوبت‌های یک ماه شمسی */
export function dueCount(h: Schedulable, jy: number, jm: number): number {
  let c = 0;
  const len = monthLength(jy, jm);
  for (let d = 1; d <= len; d++) if (isDue(h, toISO({ jy, jm, jd: d }))) c++;
  return c;
}

/** توضیح فارسی کوتاه از تکرار */
export function describeRecurrence(r?: Recurrence | null): string {
  if (!r) return "هر روز";
  const n = Math.max(1, r.interval || 1);
  let s: string;
  if (r.unit === "day") s = n === 1 ? "هر روز" : `هر ${fa(n)} روز`;
  else if (r.unit === "week") {
    const days = [...(r.days?.length ? r.days : [weekdayIndex(r.start)])].sort((a, b) => a - b);
    if (n === 1 && days.length === 7) s = "هر روز";
    else s = `${n === 1 ? "هر هفته" : `هر ${fa(n)} هفته`}: ${days.map((d) => WEEKDAYS_SHORT[d]).join("، ")}`;
  } else s = `${n === 1 ? "هر ماه" : `هر ${fa(n)} ماه`}، روز ${fa(fromISO(r.start).jd)}`;
  if (r.end?.type === "after") s += ` · ${fa(r.end.count)} بار`;
  else if (r.end?.type === "on") {
    const q = fromISO(r.end.date);
    s += ` · تا ${fa(q.jd)} ${MONTHS[q.jm - 1]}`;
  }
  return s;
}

const LOOKBACK = 400;

/**
 * رکورد پیاپی یک عادت: فقط روزهای «نوبت» شمرده می‌شوند؛ روز بدون نوبت زنجیره را نمی‌شکند.
 * اگر نوبتِ همان روز مرجع هنوز انجام نشده باشد، زنجیره نمی‌شکند.
 */
export function habitStreak(h: Schedulable, done: (iso: string) => boolean, ref: string): number {
  let s = 0;
  for (let i = 0; i < LOOKBACK; i++) {
    const d = addDays(ref, -i);
    const st = startOf(h);
    if (st && d < st) break;
    if (!isDue(h, d)) continue;
    if (done(d)) s++;
    else if (i > 0) break;
  }
  return s;
}

/**
 * رکورد «روز کامل»: روزی که همهٔ عادت‌های آن روز انجام شده باشند.
 * روزی که هیچ عادتی نوبت ندارد خنثی است (نه زنجیره را می‌شکند نه می‌افزاید).
 */
export function dayStreaks<T extends Schedulable>(
  habits: T[],
  done: (h: T, iso: string) => boolean,
  ref: string,
  window = 365
): { cur: number; best: number } {
  let cur = 0, best = 0;
  for (let i = window; i >= 0; i--) {
    const d = addDays(ref, -i);
    const due = habits.filter((h) => isDue(h, d));
    if (!due.length) continue;
    if (due.every((h) => done(h, d))) { cur++; best = Math.max(best, cur); }
    else if (i > 0) cur = 0;
  }
  return { cur, best };
}
