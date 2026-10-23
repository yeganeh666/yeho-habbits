"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, migrateLocalDataToSupabase } from "@/lib/supabase-browser";
import { getClientSupabaseCredentials } from "@/lib/supabase-config";
import { btnPrimary, Field, inputCls } from "@/components/ui";

export default function Login() {
  const r = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    const creds = getClientSupabaseCredentials();
    setIsConfigured(creds.isConfigured);

    if (creds.isConfigured) {
      sb().auth.getUser().then(({ data }) => {
        if (data?.user) {
          r.replace("/");
        }
      });
    }
  }, [r]);

  function mapAuthError(message: string): string {
    const low = message.toLowerCase();
    if (low.includes("invalid login credentials") || low.includes("invalid credential")) {
      return "ایمیل یا رمز عبور اشتباه است.";
    }
    if (low.includes("already registered") || low.includes("user already exists")) {
      return "این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید.";
    }
    if (low.includes("password should be at least") || low.includes("weak_password")) {
      return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
    }
    if (low.includes("email not confirmed")) {
      return "ایمیل شما هنوز تأیید نشده است. لطفاً صندوق ایمیل خود را بررسی کنید.";
    }
    if (low.includes("rate limit") || low.includes("too many requests")) {
      return "تعداد درخواست‌های مکرر زیاد بوده است. لطفاً چند دقیقه بعد تلاش کنید.";
    }
    if (low.includes("failed to fetch") || low.includes("network")) {
      return "عدم برقراری ارتباط با پایگاه داده. لطفاً اتصال اینترنت را بررسی فرمایید.";
    }
    return message;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");

    if (!isConfigured) {
      setErr("اتصال به پایگاه داده در متغیرهای محیطی پروژه (.env) هنوز تنظیم نشده است.");
      return;
    }

    if (mode === "up" && pw !== confirmPw) {
      setErr("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }

    setBusy(true);

    try {
      const db = sb();
      if (mode === "in") {
        const { data, error } = await db.auth.signInWithPassword({
          email: email.trim(),
          password: pw,
        });

        if (error) {
          setErr(mapAuthError(error.message));
          setBusy(false);
          return;
        }

        if (data.user) {
          await migrateLocalDataToSupabase(data.user.id);
        }

        r.replace("/");
        r.refresh();
      } else {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password: pw,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErr(mapAuthError(error.message));
          setBusy(false);
          return;
        }

        if (data.session && data.user) {
          await migrateLocalDataToSupabase(data.user.id);
          r.replace("/");
          r.refresh();
        } else {
          setInfo("حساب کاربری با موفقیت ساخته شد! لینک تأیید به ایمیل شما فرستاده شد. پس از تأیید می‌توانید وارد شوید.");
          setMode("in");
          setBusy(false);
        }
      }
    } catch (e: any) {
      setErr(mapAuthError(e?.message || "خطای نامشخص رخ داد"));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8 safe-b">
      {/* لوگو و نام برنامه */}
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[28px] bg-brand shadow-card">
          <svg width="48" height="48" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="20" stroke="rgba(255,255,255,.28)" strokeWidth="6" />
            <path d="M28 8a20 20 0 0 1 17 9.5" stroke="#4DD0E1" strokeWidth="6" strokeLinecap="round" />
            <path d="M20 29l6 6 11-12" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-ink">عادت‌ها (Habitly FA)</h1>
        <p className="mt-1 text-xs text-mute font-medium">
          ردیاب روزانه عادت‌ها و کارها با ذخیره‌سازی ابری در پایگاه داده مرکزی
        </p>
      </div>

      {!isConfigured && (
        <div className="mb-4 rounded-2xl bg-amber/15 border border-amber/30 p-4 text-center text-xs">
          <p className="font-extrabold text-amber mb-1">⚠️ در انتظار تنظیم مشخصات پایگاه داده</p>
          <p className="text-mute leading-5">
            کلیدهای اتصال Supabase باید در فایل تنظیمات <code className="bg-white/40 px-1 py-0.5 rounded font-mono">.env</code> قرار گیرند.
          </p>
        </div>
      )}

      {/* کارت ورود و ثبت‌نام */}
      <section className="rounded-hero bg-surface p-5 shadow-card border border-line/50">
        {/* زبانه‌ها */}
        <div className="mb-5 flex rounded-2xl bg-soft p-1">
          <button
            type="button"
            onClick={() => {
              setMode("in");
              setErr("");
              setInfo("");
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
              mode === "in" ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink"
            }`}
          >
            ورود به حساب
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("up");
              setErr("");
              setInfo("");
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-all ${
              mode === "up" ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink"
            }`}
          >
            ساخت حساب جدید
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="ایمیل">
            <input
              className={inputCls}
              dir="ltr"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="رمز عبور">
            <div className="relative">
              <input
                className={`${inputCls} pe-10`}
                dir="ltr"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                placeholder="حداقل ۶ کاراکتر"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-mute hover:text-ink p-1"
                aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>

          {mode === "up" && (
            <Field label="تکرار رمز عبور">
              <input
                className={inputCls}
                dir="ltr"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="تکرار رمز عبور"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </Field>
          )}

          {err && (
            <div role="alert" className="rounded-xl bg-[#E5484D]/10 p-3 text-xs font-semibold text-[#E5484D] leading-5">
              {err}
            </div>
          )}

          {info && (
            <div className="rounded-xl bg-mint/15 p-3 text-xs font-semibold text-mint leading-5">
              {info}
            </div>
          )}

          <button
            type="submit"
            className={`${btnPrimary} w-full py-3.5 text-sm font-extrabold shadow-pop`}
            disabled={busy || !isConfigured}
          >
            {busy ? "کمی صبر کنید…" : mode === "in" ? "ورود به حساب کاربری" : "ساخت حساب و ورود"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-xs font-bold text-brand hover:underline"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setErr("");
              setInfo("");
            }}
          >
            {mode === "in" ? "حساب کاربری ندارید؟ اینجا ثبت‌نام کنید" : "حساب دارید؟ وارد شوید"}
          </button>
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-mute leading-5">
        اطلاعات هر کاربر به صورت مجزا و با قوانین امنیتی RLS در دیتابیس Supabase ذخیره می‌شود.
      </p>
    </main>
  );
}
