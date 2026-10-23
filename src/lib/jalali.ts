import jalaali from "jalaali-js";

export const MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
export const WEEKDAYS = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
export const WEEKDAYS_SHORT = ["ش","ی","د","س","چ","پ","ج"];
export const WEEK_LABELS = ["هفته اول","هفته دوم","هفته سوم","هفته چهارم","هفته پنجم"];

export type JDate = { jy: number; jm: number; jd: number };
export const pad = (n: number) => String(n).padStart(2, "0");
export const fa = (v: number | string) => String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

export function toISO({ jy, jm, jd }: JDate) {
  const g = jalaali.toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
export function fromISO(iso: string): JDate {
  const [y, m, d] = iso.split("-").map(Number);
  const j = jalaali.toJalaali(y, m, d);
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
export const monthLength = (jy: number, jm: number) => jalaali.jalaaliMonthLength(jy, jm);

/** شنبه = ۰ */
export function weekdayIndex(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7;
}
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function monthRange(jy: number, jm: number) {
  return { start: toISO({ jy, jm, jd: 1 }), end: toISO({ jy, jm, jd: monthLength(jy, jm) }) };
}
export function shiftMonth(jy: number, jm: number, delta: number) {
  const idx = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(idx / 12), jm: (idx % 12) + 1 };
}
/** بلوک‌های هفتگی شیت: روزهای ۱–۷، ۸–۱۴، … ؛ روز ۲۹ و ۳۰ در هفته پنجم */
export const weekOfDay = (jd: number) => Math.min(5, Math.ceil(jd / 7));
export const weekStartISO = (iso: string) => addDays(iso, -weekdayIndex(iso));
export const prettyDate = (iso: string) => {
  const j = fromISO(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]} ${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy)}`;
};
