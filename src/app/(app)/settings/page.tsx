"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, sessionUser, migrateLocalDataToSupabase } from "@/lib/supabase-browser";
import { getClientSupabaseCredentials } from "@/lib/supabase-config";
import { btnGhost, btnPrimary, CalendarBadge, Field, inputCls } from "@/components/ui";
import { getLocalScriptUrl, setLocalScriptUrl, toast } from "@/lib/data";
import { GOOGLE_APPS_SCRIPT_SOURCE } from "@/lib/apps-script";
import type { Settings } from "@/lib/types";

const SUPABASE_SCHEMA_SQL = `-- این کد را در بخش SQL Editor پایگاه داده اجرا کنید:
create extension if not exists pgcrypto;

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  sheet_name text,
  monthly_target int,
  color text not null default '#5B3DF5',
  sort int not null default 0,
  archived boolean not null default false,
  reminder_time time,
  reminder_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists habit_targets (
  habit_id uuid references habits(id) on delete cascade,
  jy int not null, jm int not null, target int not null,
  primary key (habit_id, jy, jm)
);

create table if not exists habit_logs (
  habit_id uuid references habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  done boolean not null default false,
  pending_push boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('week','month')),
  jy int not null, jm int not null, slot int not null default 1,
  title text not null,
  done boolean not null default false,
  pending_push boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  title text not null,
  done boolean not null default false,
  remind_time time,
  remind_date date,
  event_type text default 'reminder',
  duration_minutes int default 30,
  event_id text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table todos add column if not exists sort int not null default 0;
alter table todos add column if not exists remind_date date;
alter table todos add column if not exists event_type text default 'reminder';
alter table todos add column if not exists duration_minutes int default 30;

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  script_url text,
  calendar_connected boolean default false,
  google_email text,
  last_sync_at timestamptz
);

alter table habits enable row level security;
alter table habit_targets enable row level security;
alter table habit_logs enable row level security;
alter table goals enable row level security;
alter table todos enable row level security;
alter table user_settings enable row level security;

create policy "own habits" on habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own targets" on habit_targets for all using (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid())) with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));
create policy "own logs" on habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals" on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own todos" on todos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());`;

export default function SettingsPage() {
  const r = useRouter();
  const [st, setSt] = useState<Settings | null>(null);
  const [scriptUrl, setScriptUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Supabase credentials state
  const [supabaseHost, setSupabaseHost] = useState("");
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    (async () => {
      const db = sb();
      const u = await sessionUser();
      if (!u.user) {
        r.replace("/login");
        return;
      }

      setEmail(u.user.email ?? "");
      setUserId(u.user.id ?? "");

      const creds = getClientSupabaseCredentials();
      if (creds.url) {
        try {
          const uObj = new URL(creds.url);
          setSupabaseHost(uObj.host);
        } catch {
          setSupabaseHost(creds.url);
        }
      }

      // Check if any old local mock data exists
      if (typeof window !== "undefined") {
        const rawH = localStorage.getItem("habitly_mock_habits");
        const rawT = localStorage.getItem("habitly_mock_todos");
        if ((rawH && JSON.parse(rawH).length > 0) || (rawT && JSON.parse(rawT).length > 0)) {
          setHasLegacyData(true);
        }
      }

      const { data } = await db.from("user_settings").select("*").maybeSingle();
      const localScript = getLocalScriptUrl();
      if (data) {
        setSt(data as Settings);
        setScriptUrl(data.script_url || localScript || "");
      } else if (localScript) {
        setScriptUrl(localScript);
      }

      const g = new URLSearchParams(location.search).get("google");
      if (g === "ok") toast("حساب تقویم گوگل با موفقیت متصل شد");
      else if (g === "nokeys") toast("کلیدهای اتصال گوگل (GOOGLE_CLIENT_ID) هنوز تنظیم نشده است");
      else if (g === "norefresh") toast("دسترسی تقویم از حساب گوگل حذف شده بود؛ مجدداً وصل شد");
      else if (g) toast("اتصال به تقویم گوگل ناموفق بود");
    })();
  }, [r]);

  async function handleMigrate() {
    if (!userId) return;
    setMigrating(true);
    const { migratedHabits, migratedTodos } = await migrateLocalDataToSupabase(userId);
    setMigrating(false);
    setHasLegacyData(false);
    toast(`انتقال موفق! ${migratedHabits} عادت و ${migratedTodos} کار به حساب شما منتقل شدند.`);
  }

  async function saveCalendarSettings() {
    setBusy(true);
    const clean = scriptUrl.trim();
    setLocalScriptUrl(clean);
    const u = await sessionUser();
    if (!u.user) {
      r.replace("/login");
      return;
    }
    const payload = {
      user_id: u.user.id,
      script_url: clean || null,
      calendar_connected: Boolean(clean || st?.google_email),
    };
    const { error } = await sb().from("user_settings").upsert(payload);
    setBusy(false);
    toast(error ? "ذخیره نشد؛ مجدداً تلاش کنید" : "تنظیمات تقویم گوگل با موفقیت ذخیره شد");
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
    setCopiedScript(true);
    toast("کد اسکریپت تقویم کپی شد");
    setTimeout(() => setCopiedScript(false), 2500);
  }

  function copySqlCode() {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    toast("کد SQL جداول کپی شد");
    setTimeout(() => setCopiedSql(false), 2500);
  }

  async function handleSignOut() {
    await sb().auth.signOut();
    document.cookie = "sb_url=; path=/; max-age=0";
    document.cookie = "sb_anon_key=; path=/; max-age=0";
    r.replace("/login");
    r.refresh();
  }

  return (
    <main className="mx-auto max-w-xl pb-10">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">تنظیمات حساب و برنامه</h1>
        <CalendarBadge />
      </header>

      {/* اطلاعات حساب کاربری و پایگاه داده Supabase */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card border-2 border-brand/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-mint animate-pulse" />
            <h2 className="text-base font-extrabold text-ink">حساب کاربری و پایگاه داده</h2>
          </div>
          <span className="rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-bold text-mint">
            دیتابیس ابری
          </span>
        </div>

        <div className="space-y-2 rounded-2xl bg-soft/50 p-3.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-mute">ایمیل کاربر:</span>
            <span dir="ltr" className="font-extrabold text-ink">{email || "در حال دریافت…"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-mute">سرور پایگاه داده:</span>
            <span dir="ltr" className="font-mono text-[11px] text-brand">{supabaseHost || "سرویس ابری"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-mute">شناسه کاربری (UUID):</span>
            <span dir="ltr" className="font-mono text-[10px] text-mute truncate max-w-48">{userId}</span>
          </div>
        </div>

        {hasLegacyData && (
          <div className="mt-3 rounded-2xl bg-amber/15 border border-amber/30 p-3 text-xs flex flex-col gap-2">
            <p className="font-bold text-ink">
              ⚠️ داده‌های قدیمی از حالت آفلاین/لوکال در این مرورگر یافت شد.
            </p>
            <button
              type="button"
              onClick={handleMigrate}
              disabled={migrating}
              className="rounded-xl bg-brand px-3 py-2 text-white font-bold active:scale-95 transition-transform"
            >
              {migrating ? "در حال انتقال…" : "انتقال داده‌های قبلی به حساب کاربری"}
            </button>
          </div>
        )}


      </section>

      {/* اتصال به تقویم گوگل برای یادآورها و جلسات */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📅</span>
          <h2 className="text-lg font-extrabold text-ink">اتصال به تقویم گوگل (Google Calendar)</h2>
        </div>
        <p className="mb-4 text-xs leading-6 text-mute">
          برای ثبت یادآورها و جلسات کاری در تاریخ و ساعت دلخواه با اعلان در تقویم گوشی و دسکتاپ، آدرس اسکریپت تقویم خود را وارد کنید.
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
            className={`${btnGhost} flex-1 text-xs font-bold`}
            onClick={testCalendarScript}
            disabled={testing || !scriptUrl.trim()}
          >
            {testing ? "در حال تست…" : "تست اتصال تقویم"}
          </button>
          <button type="button" className={`${btnPrimary} px-5 text-xs font-bold`} onClick={saveCalendarSettings} disabled={busy}>
            ذخیره
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-3 rounded-xl p-3 text-xs font-bold ${
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
            className="flex w-full items-center justify-between text-start text-xs font-extrabold text-brand hover:opacity-80"
            onClick={() => setShowGuide(!showGuide)}
          >
            <span>📖 راهنمای ۲ دقیقه‌ای و دریافت کد اسکریپت تقویم گوگل</span>
            <span>{showGuide ? "▲" : "▼"}</span>
          </button>

          {showGuide && (
            <div className="mt-3 space-y-3 rounded-2xl bg-soft/60 p-4 text-xs leading-6 text-ink">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-ink">نصب اسکریپت تقویم گوگل:</span>
                <button
                  type="button"
                  onClick={copyScriptCode}
                  className="rounded-xl bg-brand px-3 py-1.5 font-bold text-white shadow-card hover:bg-brand/90 transition-transform active:scale-95"
                >
                  {copiedScript ? "کپی شد ✓" : "کپی کردن کد اسکریپت"}
                </button>
              </div>

              <ol className="list-decimal space-y-1.5 pr-4 font-semibold text-mute text-[11px]">
                <li>
                  وارد آدرس <b className="text-brand">script.new</b> شوید (یا در script.google.com یک پروژه جدید بسازید).
                </li>
                <li>
                  محتوای فایل را پاک کرده، کد کپی‌شده را جایگزین کنید و دکمهٔ{" "}
                  <b className="text-ink">Save (ذخیره)</b> را بزنید.
                </li>
                <li>
                  روی دکمه آبی بالای صفحه <b className="text-ink">Deploy</b> ←{" "}
                  <b className="text-ink">New deployment</b> کلیک کنید.
                </li>
                <li>
                  نوع پروژه را <b className="text-ink">Web app</b> انتخاب کرده و در <i>Who has access</i> گزینه{" "}
                  <b className="text-brand">Anyone</b> را تعیین فرمایید.
                </li>
                <li>
                  دکمه <b className="text-ink">Deploy</b> را بزنید و آدرس Web app URL را کپی کرده و در کادر بالا ذخیره کنید.
                </li>
              </ol>

              <div className="mt-2">
                <p className="mb-1 text-[11px] font-bold text-mute">پیش‌نمایش کد اسکریپت:</p>
                <div className="relative max-h-36 overflow-y-auto rounded-xl bg-bg p-3 border border-line">
                  <pre dir="ltr" className="font-mono text-[10px] text-mute select-all">
                    {GOOGLE_APPS_SCRIPT_SOURCE}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* راهنمای نصب PWA روی گوشی */}
      <section className="mb-5 rounded-hero bg-surface p-5 shadow-card">
        <h2 className="mb-2 text-sm font-extrabold text-ink">📱 نصب PWA روی موبایل</h2>
        <p className="text-xs leading-6 text-mute">
          <b>در آیفون (iOS Safari):</b> دکمه اشتراک‌گذاری (Share) ← «Add to Home Screen».
          <br />
          <b>در اندروید (Chrome):</b> منوی سه‌نقطه ← «Install app» یا «Add to Home screen».
          <br />
          پس از نصب، این وب‌اپ بدون نوار مرورگر و درست مانند یک اپ اختصاصی و روان در دسترس شماست.
        </p>
      </section>

      {/* دکمه خروج */}
      <section className="rounded-hero bg-surface p-5 shadow-card">
        <button
          className="w-full rounded-2xl bg-[#E5484D]/10 px-5 py-3.5 font-bold text-sm text-[#E5484D] hover:bg-[#E5484D]/20 active:scale-98 transition-all"
          onClick={handleSignOut}
        >
          خروج از حساب کاربری
        </button>
      </section>
    </main>
  );
}
