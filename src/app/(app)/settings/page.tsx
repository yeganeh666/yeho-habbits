"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { fa, fromISO, MONTHS, todayISO } from "@/lib/jalali";
import { btnGhost, btnPrimary, Field, inputCls, SyncBadge } from "@/components/ui";
import { toast } from "@/lib/data";
import type { Settings } from "@/lib/types";

const idFrom = (s: string) => s.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? s.trim();

export default function SettingsPage() {
  const r = useRouter();
  const [st, setSt] = useState<Settings | null>(null);
  const [sheet, setSheet] = useState(""); const [prefix, setPrefix] = useState("حسین");
  const [busy, setBusy] = useState(false); const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await sb().auth.getUser(); setEmail(u.user?.email ?? "");
      const { data } = await sb().from("user_settings").select("*").maybeSingle();
      if (data) { setSt(data as Settings); setSheet(data.sheet_id ?? ""); setPrefix(data.tab_prefix); }
      const g = new URLSearchParams(location.search).get("google");
      if (g === "ok") toast("حساب گوگل وصل شد"); else if (g === "norefresh") toast("گوگل توکن دائمی نداد؛ دسترسی اپ را از حساب گوگل حذف و دوباره وصل کنید"); else if (g) toast("اتصال به گوگل ناموفق بود");
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { data: u } = await sb().auth.getUser();
    const { error } = await sb().from("user_settings").upsert({ user_id: u.user!.id, sheet_id: idFrom(sheet) || null, tab_prefix: prefix.trim() });
    setBusy(false); toast(error ? "ذخیره نشد" : "ذخیره شد");
  }
  async function syncNow() {
    setBusy(true); const n = fromISO(todayISO());
    const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jy: n.jy, jm: n.jm }) }).then((x) => x.json()).catch(() => ({ status: "error" }));
    setBusy(false);
    toast(res.status === "ok" ? `همگام شد (${fa(res.pushed ?? 0)} ارسال، ${fa(res.pulled ?? 0)} دریافت)` : res.status === "no_sheet" ? "اول لینک شیت را ذخیره کنید" : res.status === "not_connected" ? "اول به گوگل وصل شوید" : res.message || "همگام‌سازی ناموفق بود");
  }
  const n = fromISO(todayISO());
  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-extrabold">تنظیمات</h1><SyncBadge /></header>

      <section className="mb-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-lg font-extrabold">حساب گوگل</h2>
        <p className="mb-4 text-sm text-mute">برای نوشتن در شیت و ساختن یادآور در تقویم، یک بار وصل کنید.</p>
        {st?.google_email ? <p className="mb-3 rounded-2xl bg-mint/15 px-4 py-3 text-sm font-bold">وصل است: <span dir="ltr">{st.google_email}</span></p> : null}
        <a href="/api/google/connect" className={`${st?.google_email ? btnGhost : btnPrimary} block text-center`}>{st?.google_email ? "وصل‌کردن دوباره" : "اتصال به گوگل"}</a>
      </section>

      <section className="mb-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-lg font-extrabold">گوگل شیت</h2>
        <Field label="لینک یا شناسهٔ شیت"><input className={inputCls} dir="ltr" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /></Field>
        <Field label="پیشوند نام تب‌های ماه">
          <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          <span className="mt-1.5 block text-xs text-mute">نام تب هر ماه باید «{prefix} - ماه» باشد؛ مثل «{prefix} - {MONTHS[n.jm - 1]}». اگر تب ماه جدید نبود، از آخرین تب کپی ساخته می‌شود.</span>
        </Field>
        <div className="flex gap-3"><button className={`${btnPrimary} flex-1`} onClick={save} disabled={busy}>ذخیره</button><button className={btnGhost} onClick={syncNow} disabled={busy}>همگام‌سازی الان</button></div>
        {st?.last_sync_at && <p className="mt-3 text-xs text-mute">آخرین همگام‌سازی: {new Date(st.last_sync_at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</p>}
      </section>

      <section className="mb-4 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-2 text-lg font-extrabold">نصب روی گوشی</h2>
        <p className="text-sm leading-7 text-mute">در Safari: دکمهٔ اشتراک‌گذاری ← «Add to Home Screen». در Chrome: منو ← «Install app». بعد از نصب مثل یک اپ کامل و بدون نوار مرورگر باز می‌شود.</p>
      </section>

      <section className="rounded-hero bg-surface p-5 shadow-card">
        <p className="mb-3 text-sm text-mute">وارد شده با <span dir="ltr" className="font-bold text-ink">{email}</span></p>
        <button className="w-full rounded-2xl bg-[#E5484D]/10 px-5 py-3.5 font-bold text-[#E5484D]" onClick={async () => { await sb().auth.signOut(); r.replace("/login"); r.refresh(); }}>خروج از حساب</button>
      </section>
    </main>
  );
}
