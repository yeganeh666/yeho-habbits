"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fa } from "@/lib/jalali";
import { useSyncState } from "@/lib/data";

/* ---------- حلقهٔ پیشرفت: هر عادت یک قطعه ---------- */
export function SegRing({ segments, size = 190, stroke = 16, children, onColor = "rgb(var(--mint))", offColor = "rgba(255,255,255,.18)" }:
  { segments: boolean[]; size?: number; stroke?: number; children?: ReactNode; onColor?: string; offColor?: string }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, n = Math.max(segments.length, 1);
  const gap = n > 1 ? Math.min(10, C / n / 3) : 0, seg = C / n - gap;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {segments.length === 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={offColor} strokeWidth={stroke} />}
        {segments.map((on, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            stroke={on ? onColor : offColor} strokeDasharray={`${Math.max(seg, 1)} ${C - Math.max(seg, 1)}`} strokeDashoffset={-(i * (C / n))}
            style={{ transition: "stroke .25s" }} />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
export function Donut({ pct, size = 96, stroke = 10, color = "rgb(var(--brand))", children }: { pct: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--soft))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${C * Math.min(pct, 1)} ${C}`} style={{ transition: "stroke-dasharray .4s" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
export const pctText = (p: number) => `${fa(Math.round(p * 100))}٪`;

export function Check({ on, color = "rgb(var(--brand))", size = 32, onClick, label }: { on: boolean; color?: string; size?: number; onClick?: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on}
      className="grid shrink-0 place-items-center rounded-full border-2 transition-colors"
      style={{ width: size, height: size, borderColor: on ? color : "rgb(var(--line))", background: on ? color : "transparent" }}>
      {on && (
        <svg key="c" className="pop" width={size * .55} height={size * .55} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      )}
    </button>
  );
}
export function Bar({ value, max, color = "rgb(var(--brand))" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-soft">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, background: color }} />
    </div>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="rise max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-[32px] bg-surface p-6 pb-10 shadow-pop">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        <h2 className="mb-5 text-xl font-extrabold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold text-mute">{label}</span>{children}</label>
);
export const inputCls = "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-brand";
export const btnPrimary = "rounded-2xl bg-brand px-5 py-3.5 font-bold text-white active:scale-[.98] disabled:opacity-50";
export const btnGhost = "rounded-2xl bg-soft px-5 py-3.5 font-bold text-brand active:scale-[.98]";

/* ---------- Toast ---------- */
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const h = (e: Event) => { setMsg((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 3200); };
    window.addEventListener("toast", h); return () => { window.removeEventListener("toast", h); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return <div role="status" className="rise fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-bg shadow-pop">{msg}</div>;
}

/* ---------- نشانگر همگام‌سازی شیت ---------- */
export function SyncBadge() {
  const s = useSyncState();
  const map = {
    off: ["rgb(var(--mute))", "شیت وصل نیست"], idle: ["rgb(var(--mute))", "—"], syncing: ["rgb(var(--amber))", "در حال همگام‌سازی"],
    ok: ["rgb(var(--mint))", "با شیت همگام است"], error: ["#E5484D", s.message ? "خطا در همگام‌سازی" : "خطا"],
  } as const;
  const [c, t] = map[s.phase];
  return (
    <Link href="/settings" title={s.message} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-mute shadow-card">
      <span className={`h-2 w-2 rounded-full ${s.phase === "syncing" ? "animate-pulse" : ""}`} style={{ background: c }} />{t}
    </Link>
  );
}

/* ---------- نوار پایین ---------- */
const I = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const TABS = [
  { href: "/", label: "امروز", icon: I("M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z") },
  { href: "/habits", label: "عادت‌ها", icon: I("M4 5h16v14H4zM4 10h16M9 5v14M15 5v14") },
  { href: "/todos", label: "کارها", icon: I("M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2") },
  { href: "/stats", label: "آمار", icon: I("M5 20V10M12 20V4M19 20v-7") },
  { href: "/settings", label: "تنظیمات", icon: I("M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z") },
];
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="منوی اصلی" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <ul className="flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-pop ring-1 ring-line">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? "page" : undefined}
                className={`flex h-12 items-center justify-center gap-2 rounded-full transition-all ${on ? "bg-brand px-4 text-white" : "w-12 text-mute"}`}>
                {t.icon}{on && <span className="text-sm font-bold">{t.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
