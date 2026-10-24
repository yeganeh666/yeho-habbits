"use client";
import type { ReactNode } from "react";
import { fa } from "@/lib/jalali";

/* ---------- نمودار ناحیه‌ای (روز ۱ سمت راست، مناسب RTL) ---------- */
export function AreaChart({ values, color = "rgb(var(--mint))", height = 120, todayIndex }:
  { values: (number | null)[]; color?: string; height?: number; todayIndex?: number }) {
  const W = 320, H = height, padY = 10, n = values.length;
  const x = (i: number) => (n > 1 ? ((n - 1 - i) / (n - 1)) * W : W / 2);
  const y = (v: number) => padY + (1 - v) * (H - padY * 2);
  const pts = values.map((v, i) => (v === null ? null : ([x(i), y(v)] as [number, number])));
  const known = pts.filter(Boolean) as [number, number][];
  // چون محور وارونه است، نقطه‌ها را از چپ به راست مرتب می‌کنیم
  const sorted = [...known].sort((a, b) => a[0] - b[0]);
  const line = sorted.reduce((d, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = sorted[i - 1], cx = (qx + px) / 2;
    return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`;
  }, "");
  const area = sorted.length ? `${line} L${sorted[sorted.length - 1][0]},${H} L${sorted[0][0]},${H} Z` : "";
  const gid = `ag-${Math.round(H)}-${n}`;
  const last = todayIndex !== undefined && pts[todayIndex] ? pts[todayIndex]! : sorted.length ? sorted[0] : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="نمودار پیشرفت روزانه">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".38" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "3 5"} />
      ))}
      {area && <path d={area} fill={`url(#${gid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      {last && (<>
        <circle cx={last[0]} cy={last[1]} r="9" fill={color} opacity=".18" />
        <circle cx={last[0]} cy={last[1]} r="4.5" fill="rgb(var(--surface))" stroke={color} strokeWidth="2.6" />
      </>)}
    </svg>
  );
}

/* ---------- نقشهٔ حرارتی ماه (هفته از شنبه، راست به چپ) ---------- */
export type HeatCell = { d: number; p: number | null; today?: boolean };
export function Heatmap({ cells, offset, weekdays }: { cells: HeatCell[]; offset: number; weekdays: string[] }) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center">
        {weekdays.map((w) => <span key={w} className="text-[11px] font-semibold text-mute">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
        {cells.map((c) => (
          <div key={c.d} title={c.p === null ? "" : `${fa(Math.round(c.p * 100))}٪`}
            className={`relative grid aspect-square place-items-center rounded-xl text-[11px] font-bold ${c.today ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""} ${c.p === null ? "border border-dashed border-line text-mute/60" : ""}`}
            style={c.p === null ? undefined : { background: c.p === 0 ? "rgb(var(--soft))" : `rgb(var(--mint) / ${0.22 + c.p * 0.78})`, color: c.p > 0.55 ? "#fff" : "rgb(var(--mute))" }}>
            {fa(c.d)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-mute">
        <span>کم</span>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => <span key={p} className="h-3 w-3 rounded-[4px]" style={{ background: p === 0 ? "rgb(var(--soft))" : `rgb(var(--mint) / ${0.22 + p * 0.78})` }} />)}
        <span>زیاد</span>
      </div>
    </div>
  );
}

/* ---------- ستون‌های روزهای هفته ---------- */
export function WeekdayBars({ values, labels, best }: { values: number[]; labels: string[]; best: number }) {
  return (
    <div className="flex h-36 items-end gap-2">
      {values.map((v, i) => {
        const on = i === best && v > 0;
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <span className={`text-[11px] font-extrabold ${on ? "text-brand" : "text-mute"}`}>{fa(Math.round(v * 100))}</span>
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-2xl bg-soft">
              <div className="w-full rounded-2xl transition-[height] duration-500" style={{ height: `${Math.max(v * 100, v > 0 ? 6 : 0)}%`, background: on ? "rgb(var(--brand))" : "rgb(var(--brand) / .35)" }} />
            </div>
            <span className={`text-xs font-bold ${on ? "text-ink" : "text-mute"}`}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- گیج نیم‌دایره ---------- */
export function Gauge({ pct, color = "rgb(var(--brand))", size = 130, children }: { pct: number; color?: string; size?: number; children?: ReactNode }) {
  const stroke = 12, r = (size - stroke) / 2, len = Math.PI * r, p = Math.min(Math.max(pct, 0), 1);
  const d = `M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + 8 }}>
      <svg width={size} height={size / 2 + stroke / 2} viewBox={`0 0 ${size} ${size / 2 + stroke / 2}`} className="overflow-visible">
        <path d={d} fill="none" stroke="rgb(var(--soft))" strokeWidth={stroke} strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} style={{ transition: "stroke-dasharray .5s" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">{children}</div>
    </div>
  );
}

/* ---------- ستون‌های ماهانه با ماه جاری برجسته ---------- */
export function MonthBars({ items, max }: { items: { label: string; n: number; current?: boolean }[]; max: number }) {
  return (
    <div className="flex h-36 items-end gap-2.5">
      {items.map((h, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <span className={`text-[11px] font-extrabold ${h.current ? "text-brand" : "text-mute"}`}>{fa(h.n)}</span>
          <div className="flex w-full flex-1 items-end rounded-2xl bg-soft">
            <div className="w-full rounded-2xl transition-[height] duration-500"
              style={{ height: `${Math.max((h.n / Math.max(max, 1)) * 100, h.n > 0 ? 6 : 0)}%`, background: h.current ? "linear-gradient(180deg, rgb(var(--brand)), rgb(var(--plum)))" : "rgb(var(--brand) / .32)" }} />
          </div>
          <span className={`text-[11px] font-semibold ${h.current ? "text-ink" : "text-mute"}`}>{h.label}</span>
        </div>
      ))}
    </div>
  );
}
