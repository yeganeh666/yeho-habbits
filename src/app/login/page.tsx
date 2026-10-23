"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { btnPrimary, inputCls, Field } from "@/components/ui";

export default function Login() {
  const r = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setInfo("");
    const { error, data } = mode === "in" ? await sb().auth.signInWithPassword({ email, password: pw }) : await sb().auth.signUp({ email, password: pw });
    setBusy(false);
    if (error) return setErr(error.message.includes("Invalid") ? "ایمیل یا رمز عبور درست نیست" : error.message);
    if (mode === "up" && !data.session) return setInfo("لینک تأیید به ایمیلتان ارسال شد. بعد از تأیید وارد شوید.");
    r.replace("/"); r.refresh();
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-10 grid h-24 w-24 place-items-center rounded-[30px] bg-brand shadow-card">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="20" stroke="rgba(255,255,255,.28)" strokeWidth="6" />
          <path d="M28 8a20 20 0 0 1 17 9.5" stroke="#4DD0E1" strokeWidth="6" strokeLinecap="round" /><path d="M20 29l6 6 11-12" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h1 className="text-3xl font-extrabold leading-tight">هر روز، یک تیک جلوتر</h1>
      <p className="mb-8 mt-2 text-mute">عادت‌هایت را اینجا تیک بزن؛ شیتت خودش به‌روز می‌شود.</p>
      <form onSubmit={submit}>
        <Field label="ایمیل"><input className={inputCls} dir="ltr" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="رمز عبور"><input className={inputCls} dir="ltr" type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        {err && <p role="alert" className="mb-3 text-sm font-semibold text-[#E5484D]">{err}</p>}
        {info && <p className="mb-3 text-sm font-semibold text-mint">{info}</p>}
        <button className={`${btnPrimary} w-full`} disabled={busy}>{busy ? "کمی صبر کنید…" : mode === "in" ? "ورود" : "ساخت حساب"}</button>
      </form>
      <button className="mt-5 text-center text-sm font-semibold text-brand" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "حساب ندارم، می‌خواهم بسازم" : "حساب دارم، وارد می‌شوم"}
      </button>
    </main>
  );
}
