"use client";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Sheet } from "./ui";
import { getLocalScriptUrl, toast } from "@/lib/data";
import { sb } from "@/lib/supabase-browser";
import { todayISO } from "@/lib/jalali";
import { dailyRecurrence, startOf, type Recurrence } from "@/lib/recurrence";
import { RecurrenceEditor } from "./recurrence-editor";
import type { Habit } from "@/lib/types";

export const COLORS = ["#5B3DF5", "#26BCD0", "#AA3487", "#F5A028", "#2FA66A", "#E5484D"];

const SUGGESTIONS = ["نوشیدن آب", "مطالعه", "ورزش", "مدیتیشن", "پیاده‌روی", "خواب منظم"];

export function HabitSheet({ open, onClose, habit, month, defaultStart, presetName = "", onSave, onArchive }:
  { open: boolean; onClose: () => void; habit: Habit | null; month: { jy: number; jm: number }; /** شروع تکرار برای عادت‌های قدیمی بدون برنامه */ defaultStart?: string; presetName?: string; onSave: (v: { name: string; color: string; isPrivate: boolean; recurrence: Recurrence | null }) => Promise<void>; onArchive?: () => Promise<void> }) {
  const [name, setName] = useState(""); const [color, setColor] = useState(COLORS[0]);
  const [time, setTime] = useState(""); const [busy, setBusy] = useState(false); const [priv, setPriv] = useState(false);
  const [rec, setRec] = useState<Recurrence>(() => dailyRecurrence(todayISO()));
  const [touched, setTouched] = useState(false);
  // عادت قدیمی هنوز برنامهٔ تکرار ندارد
  const legacy = !!habit && !habit.recurrence;
  useEffect(() => {
    if (!open) return;
    setName(habit?.name.trim() ?? presetName); setColor(habit?.color ?? COLORS[0]); setTime(habit?.reminder_time?.slice(0, 5) ?? ""); setPriv(!!habit?.is_private);
    setRec(habit?.recurrence ?? dailyRecurrence(defaultStart ?? (habit ? startOf(habit) : null) ?? todayISO())); setTouched(false);
  }, [open, habit, defaultStart, presetName]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    // عادت قدیمی تا وقتی کاربر تکرار را انتخاب نکرده همان‌طور می‌ماند
    await onSave({ name: name.trim(), color, isPrivate: priv, recurrence: !legacy || touched ? rec : null });
    if (habit && time !== (habit.reminder_time?.slice(0, 5) ?? "")) {
      const scriptUrl = getLocalScriptUrl();
      const r = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "habit",
          id: habit.id,
          title: name.trim(),
          eventId: habit.reminder_event_id,
          time: time || null,
          scriptUrl,
        }),
      });
      if (!r.ok) {
        toast("یادآور در تقویم ساخته نشد؛ اتصال تقویم را در تنظیمات بررسی کنید");
      } else {
        const j = await r.json().catch(() => ({}));
        await sb().from("habits").update({
          reminder_time: time || null,
          reminder_event_id: time ? (j.eventId || habit.reminder_event_id) : null,
        }).eq("id", habit.id);
      }
    }
    setBusy(false); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title={habit ? "ویرایش عادت" : "عادت جدید"}>
      <Field label="نام عادت"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً ۲ صفحه قرآن" autoFocus /></Field>
      {!habit && (
        <div className="-mt-2 mb-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((x) => (
            <button key={x} type="button" onClick={() => setName(x)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${name === x ? "bg-brand text-white" : "bg-soft text-brand"}`}>{x}</button>
          ))}
        </div>
      )}
      {legacy && !touched && (
        <p className="mb-4 rounded-2xl bg-amber/15 p-3.5 text-sm font-semibold leading-relaxed">برای این عادت هنوز روزهای انجام مشخص نشده (فعلاً «هر روز» حساب می‌شود). تکرار را انتخاب کن تا برنامهٔ هر روز و رکورد پیاپی دقیق شود.</p>
      )}
      <RecurrenceEditor value={rec} onChange={(r) => { setRec(r); setTouched(true); }} month={month} />
      <Field label="رنگ">
        <div className="flex justify-between">{COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`رنگ ${c}`} aria-pressed={color === c}
            className="grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-90" style={{ background: c, boxShadow: color === c ? `0 0 0 3px rgb(var(--surface)), 0 0 0 5px ${c}` : undefined }}>
            {color === c && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
          </button>
        ))}</div>
      </Field>
      <button type="button" role="switch" aria-checked={priv} onClick={() => setPriv(!priv)} className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-bg p-3.5 text-start">
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">پنهان از دوستان</span><span className="block text-xs text-mute">این عادت در جدول دوستانت دیده نمی‌شود</span></span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${priv ? "bg-brand" : "bg-line"}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${priv ? "start-[22px]" : "start-0.5"}`} /></span>
      </button>
      {habit && (
        <Field label="یادآور روزانه در تقویم گوگل (اختیاری)">
          <div className="flex gap-2"><input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            {time && <button type="button" className={btnGhost} onClick={() => setTime("")}>حذف</button>}</div>
        </Field>
      )}
      <div className="mt-6 flex gap-3">
        <button className={`${btnPrimary} flex-1`} onClick={save} disabled={busy || !name.trim()}>{habit ? "ذخیره" : "افزودن عادت"}</button>
        {habit && onArchive && <button className="rounded-2xl bg-[#E5484D]/10 px-5 font-bold text-[#E5484D]" onClick={async () => { await onArchive(); onClose(); }}>بایگانی</button>}
      </div>
    </Sheet>
  );
}
