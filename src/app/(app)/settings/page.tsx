"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { btnGhost, btnPrimary, CalendarBadge, Field, inputCls } from "@/components/ui";
import { toast } from "@/lib/data";
import { GOOGLE_APPS_SCRIPT_SOURCE } from "@/lib/apps-script";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const r = useRouter();
  const [st, setSt] = useState<Settings | null>(null);
  const [scriptUrl, setScriptUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await sb().auth.getUser();
      setEmail(u.user?.email ?? "");
      const { data } = await sb().from("user_settings").select("*").maybeSingle();
      if (data) {
        setSt(data as Settings);
        setScriptUrl(data.script_url ?? "");
      }
      const g = new URLSearchParams(location.search).get("google");
      if (g === "ok") toast("حساب تقویم گوگل با موفقیت متصل شد");
      else if (g === "nokeys") toast("کلیدهای اتصال گوگل (GOOGLE_CLIENT_ID) هنوز تنظیم نشده است");
      else if (g === "norefresh") toast("دسترسی تقویم از حساب گوگل حذف شده بود؛ مجدداً وصل شد");
      else if (g) toast("اتصال به تقویم گوگل ناموفق بود");
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { data: u } = await sb().auth.getUser();
    const payload = {
      user_id: u.user!.id,
      script_url: scriptUrl.trim() || null,
      calendar_connected: Boolean(scriptUrl.trim() || st?.google_email),
    };
    const { error } = await sb().from("user_settings").upsert(payload);
    setBusy(false);
    toast(error ? "ذخیره نشد" : "تنظیمات تقویم گوگل با موفقیت ذخیره شد");
  }

  async function testCalendarScript() {
    const cleanUrl = scriptUrl.trim();
    if (!cleanUrl) {
      toast("ابتدا آدرس اسکریپت تقویم را وارد کنید");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/apps-script/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptUrl: cleanUrl }),
      }).then((x) => x.json());

      if (res.ok) {
        setTestResult({
          ok: true,
          message: `اتصال به تقویم گوگل با موفقیت تأیید شد! (حساب گوگل: ${res.email})`,
        });
        toast("اتصال تقویم گوگل برقرار است");
      } else {
        setTestResult({ ok: false, message: res.error || "پاسخ معتبر از اسکریپت تقویم دریافت نشد." });
        toast("خطا در اتصال به اسکریپت");
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message || "امکان برقراری ارتباط با اسکریپت تقویم وجود ندارد." });
      toast("خطا در اتصال");
    } finally {
      setTesting(false);
    }
  }

  function copyScriptCode() {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SOURCE);
    setCopied(true);
    toast("کد اسکریپت تقویم کپی شد");
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">تنظیمات</h1>
        <CalendarBadge />
      </header>

      {/* بخش اصلی: اتصال تقویم گوگل برای یادآورها و جلسات */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card border-2 border-brand/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📅</span>
          <h2 className="text-lg font-extrabold text-ink">اتصال به تقویم گوگل (Google Calendar)</h2>
        </div>
        <p className="mb-4 text-sm leading-6 text-mute">
          برای ثبت یادآورها و جلسات کاری در تاریخ و ساعت دلخواه با اعلان در گوشی و تقویم، تقویم گوگل خود را متصل کنید.
        </p>

        <Field label="آدرس وب اپلیکیشن اسکریپت تقویم (Apps Script Web App URL)">
          <input
            className={inputCls}
            dir="ltr"
            value={scriptUrl}
            onChange={(e) => {
              setScriptUrl(e.target.value);
              setTestResult(null);
            }}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
          />
        </Field>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={`${btnGhost} flex-1 text-sm font-bold`}
            onClick={testCalendarScript}
            disabled={testing || !scriptUrl.trim()}
          >
            {testing ? "در حال تست…" : "تست اتصال تقویم"}
          </button>
          <button type="button" className={`${btnPrimary} px-5`} onClick={save} disabled={busy}>
            ذخیره
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-3 rounded-xl p-3 text-sm font-bold ${
              testResult.ok ? "bg-mint/15 text-mint" : "bg-[#E5484D]/10 text-[#E5484D]"
            }`}
          >
            {testResult.message}
          </div>
        )}

        {/* راهنما و کد آماده اسکریپت تقویم */}
        <div className="mt-4 border-t border-line/60 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-start text-sm font-extrabold text-brand hover:opacity-80"
            onClick={() => setShowGuide(!showGuide)}
          >
            <span>📖 راهنمای ۲ دقیقه‌ای و دریافت کد اسکریپت تقویم</span>
            <span>{showGuide ? "▲" : "▼"}</span>
          </button>

          {showGuide && (
            <div className="mt-3 space-y-3 rounded-2xl bg-soft/60 p-4 text-xs leading-6 text-ink">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-ink">نصب اسکریپت تقویم گوگل:</span>
                <button
                  type="button"
                  onClick={copyScriptCode}
                  className="rounded-xl bg-brand px-3 py-1.5 font-bold text-white shadow-card hover:bg-brand/90 transition-transform active:scale-95"
                >
                  {copied ? "کپی شد ✓" : "کپی کردن کد اسکریپت"}
                </button>
              </div>

              <ol className="list-decimal space-y-2 pr-4 font-semibold text-mute">
                <li>
                  وارد آدرس <b className="text-brand">script.new</b> شوید (یا وارد script.google.com شده و یک پروژهٔ جدید بسازید).
                </li>
                <li>
                  محتوای پیش‌فرض داخل فایل را پاک کرده، کد کپی‌شده را جایگزین کنید و دکمهٔ{" "}
                  <b className="text-ink">Save (آیکون ذخیره)</b> را بزنید.
                </li>
                <li>
                  روی دکمه آبی بالای صفحه <b className="text-ink">Deploy (استقرار)</b> ←{" "}
                  <b className="text-ink">New deployment</b> کلیک کنید.
                </li>
                <li>
                  نوع پروژه را <b className="text-ink">Web app</b> انتخاب کرده و در بخش <i>Who has access</i> گزینه{" "}
                  <b className="text-brand">Anyone (هر کسی)</b> را تعیین کنید.
                </li>
                <li>
                  دکمه <b className="text-ink">Deploy</b> را بزنید و آدرس نهایی Web app URL را کپی کرده و در کادر بالا قرار دهید.
                </li>
              </ol>

              <div className="mt-2">
                <p className="mb-1 text-[11px] font-bold text-mute">پیش‌نمایش کد اسکریپت تقویم:</p>
                <div className="relative max-h-44 overflow-y-auto rounded-xl bg-bg p-3 border border-line">
                  <pre dir="ltr" className="font-mono text-[11px] text-mute select-all">
                    {GOOGLE_APPS_SCRIPT_SOURCE}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* وضعیت ذخیره‌سازی اطلاعات در دیتابیس Supabase */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-3 w-3 rounded-full bg-mint animate-pulse" />
          <h2 className="text-base font-extrabold text-ink">پایگاه داده و ذخیره‌سازی ابری (Supabase)</h2>
        </div>
        <p className="text-xs leading-6 text-mute">
          تمام عادت‌ها، هدف‌های هفتگی و ماهانه، تیک‌های روزانه و کارهای شما مستقیماً در پایگاه دادهٔ Supabase ذخیره می‌شوند و نیازی به گوگل شیت ندارند. داده‌های شما به‌صورت آنی ذخیره شده و هیچ محدودیت ۳۰ روزه‌ای وجود ندارد.
        </p>
      </section>

      {/* اتصال مستقیم با OAuth (گزینه جایگزین) */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card opacity-90">
        <h2 className="mb-1 text-sm font-extrabold text-ink">اتصال جایگزین با حساب گوگل (OAuth)</h2>
        <p className="mb-3 text-xs text-mute leading-5">
          در صورت تمایل به اتصال مستقیم با حساب کاربری گوگل:
        </p>
        {st?.google_email ? (
          <p className="mb-3 rounded-2xl bg-mint/15 px-4 py-2.5 text-xs font-bold text-mint">
            حساب متصل: <span dir="ltr">{st.google_email}</span>
          </p>
        ) : null}
        <a
          href="/api/google/connect"
          className={`${st?.google_email ? btnGhost : "rounded-xl border border-line bg-soft py-2 px-4 text-xs font-bold text-ink"} block text-center`}
        >
          {st?.google_email ? "اتصال دوباره حساب تقویم گوگل" : "ورود با گوگل برای اتصال تقویم"}
        </a>
      </section>

      {/* راهنمای نصب PWA روی گوشی */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-2 text-base font-extrabold">نصب روی گوشی</h2>
        <p className="text-xs leading-6 text-mute">
          در Safari: دکمهٔ اشتراک‌گذاری ← «Add to Home Screen». در Chrome: منو ← «Install app». بعد از نصب مثل یک اپ کامل و بدون نوار مرورگر باز می‌شود.
        </p>
      </section>

      {/* خروج */}
      <section className="rounded-hero bg-surface p-5 shadow-card">
        <p className="mb-3 text-xs text-mute">
          شناسه کاربر: <span dir="ltr" className="font-bold text-ink">{email}</span>
        </p>
        <button
          className="w-full rounded-2xl bg-[#E5484D]/10 px-5 py-3 font-bold text-sm text-[#E5484D] hover:bg-[#E5484D]/20 transition-colors"
          onClick={async () => {
            await sb().auth.signOut();
            r.replace("/login");
            r.refresh();
          }}
        >
          خروج از حساب
        </button>
      </section>
    </main>
  );
}
