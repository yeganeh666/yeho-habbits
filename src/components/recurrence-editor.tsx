"use client";
import { useState } from "react";
import { addDays, fa, fromISO, prettyDate, WEEKDAYS, WEEKDAYS_SHORT, weekdayIndex } from "@/lib/jalali";
import { dueCount, describeRecurrence, type Recurrence } from "@/lib/recurrence";
import { JalaliCalendarModal } from "./calendar-picker";
import { inputCls } from "./ui";

const UNITS = [["day", "روز"], ["week", "هفته"], ["month", "ماه"]] as const;

const PRESETS: { label: string; make: (start: string) => Recurrence }[] = [
  { label: "هر روز", make: (start) => ({ unit: "day", interval: 1, start, end: { type: "never" } }) },
  { label: "شنبه تا چهارشنبه", make: (start) => ({ unit: "week", interval: 1, days: [0, 1, 2, 3, 4], start, end: { type: "never" } }) },
  { label: "یک‌روز در میان", make: (start) => ({ unit: "day", interval: 2, start, end: { type: "never" } }) },
];

const same = (a: Recurrence, b: Recurrence) => JSON.stringify([a.unit, a.interval, a.days ?? null, a.end ?? null]) === JSON.stringify([b.unit, b.interval, b.days ?? null, b.end ?? null]);

/** شمارندهٔ عددی با دکمه‌های + و − */
function Stepper({ value, min = 1, max = 999, onChange, label }: { value: number; min?: number; max?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-bg p-1">
      <button type="button" aria-label={`${label}: کمتر`} onClick={() => onChange(Math.max(min, value - 1))} className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-lg font-bold shadow-card active:scale-95">−</button>
      <span aria-label={label} className="min-w-9 text-center text-lg font-extrabold">{fa(value)}</span>
      <button type="button" aria-label={`${label}: بیشتر`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-lg font-bold shadow-card active:scale-95">+</button>
    </div>
  );
}

/**
 * ویرایشگر تکرار شبیه «Custom recurrence» تقویم گوگل:
 * هر N روز/هفته/ماه، روزهای هفته، و پایان (هرگز / در تاریخ / بعد از N بار).
 */
export function RecurrenceEditor({ value, onChange, month }: { value: Recurrence; onChange: (r: Recurrence) => void; month: { jy: number; jm: number } }) {
  const [pickEnd, setPickEnd] = useState(false);
  const interval = Math.max(1, value.interval || 1);
  const end = value.end ?? { type: "never" as const };
  const days = value.days?.length ? value.days : [weekdayIndex(value.start)];
  const set = (patch: Partial<Recurrence>) => onChange({ ...value, ...patch });

  const setUnit = (unit: Recurrence["unit"]) => set({ unit, days: unit === "week" ? days : undefined });
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (next.length) set({ days: next.sort((a, b) => a - b) });
  };
  const setEnd = (type: "never" | "on" | "after") => {
    if (type === "never") set({ end: { type: "never" } });
    else if (type === "on") set({ end: { type: "on", date: end.type === "on" ? end.date : addDays(value.start, 30) } });
    else set({ end: { type: "after", count: end.type === "after" ? end.count : 10 } });
  };

  const count = dueCount({ recurrence: value }, month.jy, month.jm);

  return (
    <div className="mb-5">
      <div className="mb-2 text-sm font-semibold text-mute">هر چند وقت یک‌بار انجام می‌شود؟</div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const r = p.make(value.start);
          return (
            <button key={p.label} type="button" onClick={() => onChange(r)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${same(value, r) ? "bg-brand text-white" : "bg-soft text-brand"}`}>{p.label}</button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-bg p-3.5">
        {/* تکرار هر ... */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">تکرار هر</span>
          <Stepper value={interval} onChange={(n) => set({ interval: n })} label="فاصلهٔ تکرار" />
          <select aria-label="واحد تکرار" value={value.unit} onChange={(e) => setUnit(e.target.value as Recurrence["unit"])} className={`${inputCls} !w-auto !py-2.5`}>
            {UNITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {/* روزهای هفته */}
        {value.unit === "week" && (
          <div className="mt-4">
            <div className="mb-2 text-sm font-bold">در این روزها</div>
            <div className="flex justify-between gap-1" role="group" aria-label="روزهای هفته">
              {WEEKDAYS_SHORT.map((l, d) => {
                const on = days.includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAYS[d]} onClick={() => toggleDay(d)}
                    className={`grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold transition-colors active:scale-90 ${on ? "bg-brand text-white" : "bg-soft text-brand"}`}>{l}</button>
                );
              })}
            </div>
          </div>
        )}
        {value.unit === "month" && <p className="mt-3 text-xs text-mute">هر ماه در همان روزی از ماه که عادت شروع شده (روز {fa(fromISO(value.start).jd)} ماه) انجام می‌شود.</p>}

        {/* پایان */}
        <div className="mt-4">
          <div className="mb-2 text-sm font-bold">پایان</div>
          <div role="radiogroup" aria-label="پایان تکرار" className="space-y-2">
            <label className="flex items-center gap-3"><input type="radio" name="rec-end" checked={end.type === "never"} onChange={() => setEnd("never")} className="h-5 w-5 accent-[rgb(var(--brand))]" /><span className="text-sm font-semibold">هرگز</span></label>
            <div className="flex items-center gap-3">
              <input type="radio" name="rec-end" aria-label="در تاریخ" checked={end.type === "on"} onChange={() => setEnd("on")} className="h-5 w-5 accent-[rgb(var(--brand))]" />
              <span className="text-sm font-semibold">در تاریخ</span>
              <button type="button" disabled={end.type !== "on"} onClick={() => setPickEnd(true)} className="rounded-xl bg-surface px-3 py-2 text-sm font-bold text-brand shadow-card disabled:opacity-40">{end.type === "on" ? prettyDate(end.date) : "انتخاب تاریخ"}</button>
            </div>
            <div className="flex items-center gap-3">
              <input type="radio" name="rec-end" aria-label="بعد از چند بار" checked={end.type === "after"} onChange={() => setEnd("after")} className="h-5 w-5 accent-[rgb(var(--brand))]" />
              <span className="text-sm font-semibold">بعد از</span>
              <div className={end.type === "after" ? "" : "pointer-events-none opacity-40"}>
                <Stepper value={end.type === "after" ? end.count : 10} onChange={(n) => set({ end: { type: "after", count: n } })} label="تعداد دفعات" />
              </div>
              <span className="text-sm font-semibold">بار</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2.5 rounded-2xl bg-soft px-3.5 py-2.5 text-sm font-semibold text-brand">
        {describeRecurrence(value)} · {count > 0 ? `${fa(count)} نوبت در این ماه` : "این ماه نوبتی ندارد"}
      </p>

      <JalaliCalendarModal
        open={pickEnd}
        onClose={() => setPickEnd(false)}
        value={end.type === "on" ? end.date : value.start}
        title="تاریخ پایان تکرار"
        onChange={(iso) => set({ end: { type: "on", date: iso < value.start ? value.start : iso } })}
      />
    </div>
  );
}
