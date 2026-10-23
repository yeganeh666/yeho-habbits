"use client";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Sheet } from "./ui";
import { toast } from "@/lib/data";
import type { Habit } from "@/lib/types";

export const COLORS = ["#5B3DF5", "#26BCD0", "#AA3487", "#F5A028", "#2FA66A", "#E5484D"];

export function HabitSheet({ open, onClose, habit, defaultTarget, onSave, onArchive }:
  { open: boolean; onClose: () => void; habit: Habit | null; defaultTarget: number; onSave: (v: { name: string; target: number; color: string }) => Promise<void>; onArchive?: () => Promise<void> }) {
  const [name, setName] = useState(""); const [target, setTarget] = useState(defaultTarget); const [color, setColor] = useState(COLORS[0]);
  const [time, setTime] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(habit?.name.trim() ?? ""); setTarget(defaultTarget); setColor(habit?.color ?? COLORS[0]); setTime(habit?.reminder_time?.slice(0, 5) ?? "");
  }, [open, habit, defaultTarget]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true); await onSave({ name: name.trim(), target, color });
    if (habit && time !== (habit.reminder_time?.slice(0, 5) ?? "")) {
      const r = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "habit", id: habit.id, time: time || null }) });
      if (!r.ok) toast("یادآور در تقویم ساخته نشد؛ اتصال گوگل را در تنظیمات بررسی کنید");
    }
    setBusy(false); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title={habit ? "ویرایش عادت" : "عادت جدید"}>
      <Field label="نام عادت"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً ۲ صفحه قرآن" autoFocus /></Field>
      <Field label="هدف این ماه (چند روز؟)"><input className={inputCls} type="number" min={1} max={31} value={target} onChange={(e) => setTarget(+e.target.value)} /></Field>
      <Field label="رنگ">
        <div className="flex gap-3">{COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`رنگ ${c}`} aria-pressed={color === c}
            className="h-9 w-9 rounded-full ring-offset-2 ring-offset-surface" style={{ background: c, boxShadow: color === c ? `0 0 0 3px ${c}55, 0 0 0 2px rgb(var(--surface)) inset` : undefined, outline: color === c ? `2px solid ${c}` : undefined, outlineOffset: 3 }} />
        ))}</div>
      </Field>
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
