"use client";
import { useState } from "react";
import {
  addDays,
  fa,
  fromISO,
  monthLength,
  MONTHS,
  prettyDate,
  shiftMonth,
  todayISO,
  toISO,
  WEEKDAYS_SHORT,
  weekdayIndex,
} from "@/lib/jalali";
import { Sheet } from "./ui";

interface JalaliCalendarModalProps {
  open: boolean;
  onClose: () => void;
  value: string; // ISO date YYYY-MM-DD
  onChange: (iso: string) => void;
  title?: string;
}

export function JalaliCalendarModal({
  open,
  onClose,
  value,
  onChange,
  title = "انتخاب تاریخ در گاه‌شمار",
}: JalaliCalendarModalProps) {
  const initial = fromISO(value || todayISO());
  const [ym, setYm] = useState({ jy: initial.jy, jm: initial.jm });
  const today = todayISO();

  const len = monthLength(ym.jy, ym.jm);
  const firstDayISO = toISO({ jy: ym.jy, jm: ym.jm, jd: 1 });
  const startOffset = weekdayIndex(firstDayISO); // ۰ برای شنبه تا ۶ برای جمعه
  const days = Array.from({ length: len }, (_, i) => i + 1);

  const selectDate = (jd: number) => {
    const selectedISO = toISO({ jy: ym.jy, jm: ym.jm, jd });
    onChange(selectedISO);
    onClose();
  };

  const jumpTo = (iso: string) => {
    const j = fromISO(iso);
    setYm({ jy: j.jy, jm: j.jm });
    onChange(iso);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* نوار جابجایی ماه و سال */}
        <div className="flex items-center justify-between rounded-2xl bg-soft/60 p-2">
          <button
            type="button"
            aria-label="ماه بعد"
            onClick={() => setYm(shiftMonth(ym.jy, ym.jm, 1))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-lg font-bold text-ink shadow-sm active:scale-95 transition-transform"
          >
            ‹
          </button>
          <div className="text-center">
            <span className="block text-base font-extrabold text-ink">
              {MONTHS[ym.jm - 1]} {fa(ym.jy)}
            </span>
          </div>
          <button
            type="button"
            aria-label="ماه قبل"
            onClick={() => setYm(shiftMonth(ym.jy, ym.jm, -1))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-lg font-bold text-ink shadow-sm active:scale-95 transition-transform"
          >
            ›
          </button>
        </div>

        {/* سربرگ روزهای هفته */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS_SHORT.map((w, idx) => (
            <div
              key={w}
              className={`py-1 text-xs font-bold ${
                idx === 6 ? "text-[#E5484D]" : "text-mute"
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* شبکه تقویم ماه */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {/* خانه‌های خالی قبل از روز اول ماه */}
          {Array.from({ length: startOffset }, (_, i) => (
            <div key={`blank-${i}`} className="h-10 w-full" />
          ))}

          {/* روزهای ماه */}
          {days.map((d) => {
            const currentISO = toISO({ jy: ym.jy, jm: ym.jm, jd: d });
            const isSelected = currentISO === value;
            const isToday = currentISO === today;
            const isFriday = (startOffset + d - 1) % 7 === 6;

            return (
              <button
                key={d}
                type="button"
                onClick={() => selectDate(d)}
                className={`relative flex h-10 w-full flex-col items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-90 ${
                  isSelected
                    ? "bg-brand text-white shadow-card scale-105 z-10"
                    : isToday
                    ? "bg-mint/20 text-mint ring-2 ring-mint/50"
                    : isFriday
                    ? "text-[#E5484D] hover:bg-soft"
                    : "text-ink hover:bg-soft"
                }`}
              >
                <span>{fa(d)}</span>
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-mint" />
                )}
              </button>
            );
          })}
        </div>

        {/* پیش‌نمایش تاریخ انتخاب‌شده */}
        <div className="rounded-xl bg-brand/10 p-2.5 text-center text-xs font-bold text-brand">
          تاریخ انتخاب‌شده: {prettyDate(value)}
        </div>

        {/* کلیدهای دسترسی سریع */}
        <div className="flex items-center justify-between gap-1.5 border-t border-line/60 pt-3">
          <button
            type="button"
            onClick={() => jumpTo(today)}
            className="flex-1 rounded-xl bg-soft py-2 text-xs font-bold text-ink active:scale-95 transition-transform"
          >
            امروز
          </button>
          <button
            type="button"
            onClick={() => jumpTo(addDays(today, 1))}
            className="flex-1 rounded-xl bg-soft py-2 text-xs font-bold text-ink active:scale-95 transition-transform"
          >
            فردا
          </button>
          <button
            type="button"
            onClick={() => jumpTo(addDays(today, 2))}
            className="flex-1 rounded-xl bg-soft py-2 text-xs font-bold text-ink active:scale-95 transition-transform"
          >
            پس‌فردا
          </button>
        </div>
      </div>
    </Sheet>
  );
}
