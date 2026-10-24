"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { fa } from "@/lib/jalali";

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

/* ---------- نشانگر وضعیت اتصال تقویم گوگل ---------- */
export function CalendarBadge() {
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("habitly_mock_user_settings");
      if (raw) {
        const item = JSON.parse(raw);
        const st = Array.isArray(item) ? item[0] : item;
        if (st?.script_url || st?.google_email) {
          setConnected(true);
          return;
        }
      }
    } catch {}
    setConnected(false);
  }, []);

  return (
    <Link
      href="/settings"
      title={connected ? "تقویم گوگل متصل است" : "اتصال به تقویم گوگل"}
      className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-mute shadow-card hover:text-ink transition-colors"
    >
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-mint" : "bg-mute/40"}`} />
      <span>{connected ? "تقویم متصل" : "اتصال تقویم"}</span>
    </Link>
  );
}

export const SyncBadge = CalendarBadge;

/* ---------- نوار پایین (موبایل‌فرست) ---------- */
const I = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const TABS = [
  { href: "/", label: "امروز", icon: I("M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z") },
  { href: "/habits", label: "عادت‌ها", icon: I("M4 5h16v14H4zM4 10h16M9 5v14M15 5v14") },
  { href: "/pomodoro", label: "پومودورو", icon: I("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0zM10 2h4") },
  { href: "/todos", label: "کارها", icon: I("M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2") },
  { href: "/stats", label: "آمار", icon: I("M5 20V10M12 20V4M19 20v-7") },
  { href: "/friends", label: "دوستان", icon: I("M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16.5 4.4a3.5 3.5 0 010 6.7M18 14.8c2.2.6 3.5 2.3 3.5 5.2") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="منوی اصلی" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-none">
      <ul className="pointer-events-auto flex items-center justify-between w-full max-w-md rounded-3xl bg-surface/95 backdrop-blur-md p-1.5 shadow-pop ring-1 ring-line/80">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1 text-center">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all active:scale-90 ${
                  on
                    ? "bg-brand text-white font-extrabold shadow-sm scale-102"
                    : "text-mute hover:text-ink font-semibold"
                }`}
              >
                {t.icon}
                <span className="text-[10px] leading-tight select-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
