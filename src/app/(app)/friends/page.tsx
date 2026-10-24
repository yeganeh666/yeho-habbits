"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fa, fromISO, MONTHS, todayISO } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { avatarColor, fetchBoard, makeBoard, nameOf, useFriends } from "@/lib/friends";
import { CalendarBadge, pctText } from "@/components/ui";
import { Avatar } from "@/components/avatar";

type Row = { key: string; email: string; label: string; pct: number; done: number; target: number; today: number; total: number; me?: boolean; href?: string; failed?: boolean };

export default function Friends() {
  const now = fromISO(todayISO());
  const today = todayISO();
  const f = useFriends();
  const mine = useMonth(now.jy, now.jm);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [others, setOthers] = useState<Record<string, Row>>({});
  const [loadingBoards, setLoadingBoards] = useState(false);

  const idsKey = f.friends.map((x) => x.userId).join(",");
  useEffect(() => {
    if (!f.friends.length) { setOthers({}); return; }
    let alive = true;
    setLoadingBoards(true);
    Promise.all(f.friends.map(async (fr) => {
      try {
        const b = makeBoard(await fetchBoard(fr.userId, now.jy, now.jm), now.jy, now.jm);
        const todayDone = b.habits.filter((h) => b.isDone(h.id, today)).length;
        return [fr.userId, { key: fr.userId, email: fr.email, label: nameOf(fr.email), pct: b.pct, done: b.done, target: b.target, today: todayDone, total: b.habits.length, href: `/friends/${fr.userId}` } as Row] as const;
      } catch { return [fr.userId, { key: fr.userId, email: fr.email, label: nameOf(fr.email), pct: 0, done: 0, target: 0, today: 0, total: 0, href: `/friends/${fr.userId}`, failed: true } as Row] as const; }
    })).then((r) => alive && setOthers(Object.fromEntries(r))).finally(() => alive && setLoadingBoards(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, now.jy, now.jm]);

  const active = mine.habits.filter((h) => !h.archived);
  const myDone = active.reduce((s, h) => s + mine.countOf(h.id), 0), myTarget = active.reduce((s, h) => s + mine.targetOf(h), 0);
  const meRow: Row = { key: "me", email: f.me?.email || "me", label: "تو", pct: myTarget ? myDone / myTarget : 0, done: myDone, target: myTarget, today: active.filter((h) => mine.isDone(h.id, today)).length, total: active.length, me: true };
  const ranking = useMemo(() => [meRow, ...Object.values(others)].sort((a, b) => b.pct - a.pct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [others, myDone, myTarget, active.length]);
  const myRank = ranking.findIndex((r) => r.me) + 1;
  const leader = ranking[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await f.send(email);
    setBusy(false); setMsg({ ok: r.ok, text: r.message }); if (r.ok) setEmail("");
  }
  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try { if (navigator.share) await navigator.share({ title: "عادت‌ها", text: "بیا با هم عادت‌هایمان را دنبال کنیم!", url }); else { await navigator.clipboard.writeText(url); setMsg({ ok: true, text: "لینک اپ کپی شد" }); } } catch {}
  }

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : fa(i + 1));
  const gapText = (() => {
    if (ranking.length < 2) return "";
    if (myRank === 1) return `جلوتری! ${fa(Math.round((ranking[0].pct - ranking[1].pct) * 100))}٪ از ${ranking[1].label} جلوتر هستی`;
    return `${fa(Math.round((leader.pct - meRow.pct) * 100))}٪ تا ${leader.label} فاصله داری؛ می‌رسی!`;
  })();

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-mute">با هم رقابت کنید</p><h1 className="text-2xl font-extrabold">دوستان</h1></div>
        <CalendarBadge />
      </header>

      {f.error && <p role="alert" className="mb-4 rounded-2xl bg-[#E5484D]/10 p-3.5 text-sm font-semibold text-[#E5484D]">{f.error}</p>}

      {/* افزودن دوست */}
      <section className="rounded-hero bg-surface p-5 shadow-card">
        <h2 className="text-lg font-extrabold">دوستت را با ایمیل پیدا کن</h2>
        <p className="mt-0.5 text-sm text-mute">ایمیلی که دوستت با آن در اپ ثبت‌نام کرده را بنویس.</p>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input type="email" inputMode="email" autoComplete="off" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" aria-label="ایمیل دوست"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-start text-base outline-none placeholder:text-mute/60 focus:border-brand" />
          <button disabled={busy || !email.trim()} className="shrink-0 rounded-2xl bg-brand px-5 font-bold text-white active:scale-95 disabled:opacity-50">{busy ? "…" : "ارسال"}</button>
        </form>
        {msg && (
          <div role="status" className={`mt-3 rounded-2xl p-3 text-sm font-semibold ${msg.ok ? "bg-mint/15 text-ink" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
            {msg.text}
            {msg.ok && <button onClick={share} className="mt-2 block text-sm font-bold text-brand">اگر هنوز عضو نیست، لینک اپ را برایش بفرست ‹</button>}
          </div>
        )}
        <p className="mt-3 text-xs leading-6 text-mute">بعد از پذیرش دوستی، دوستت جدول عادت‌های تو را می‌بیند (به‌جز عادت‌هایی که «پنهان از دوستان» کرده‌ای). هر وقت خواستی دوستی را حذف کن.</p>
      </section>

      {/* درخواست‌های دریافتی */}
      {f.incoming.length > 0 && (
        <section className="mt-6" aria-label="درخواست‌ها">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">درخواست‌ها<span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">{fa(f.incoming.length)}</span></h2>
          <ul className="space-y-2.5">
            {f.incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-row bg-surface p-3.5 shadow-card ring-1 ring-brand/25">
                <Avatar email={r.requester_email} />
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{nameOf(r.requester_email)}</p><p dir="ltr" className="truncate text-start text-xs text-mute">{r.requester_email}</p></div>
                <button onClick={() => f.accept(r.id)} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white active:scale-95">قبول</button>
                <button onClick={() => f.remove(r.id)} aria-label="رد درخواست" className="grid h-9 w-9 place-items-center rounded-xl bg-soft text-mute active:scale-95">✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* رده‌بندی */}
      {f.friends.length > 0 && (
        <section className="mt-7" aria-label="رده‌بندی">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-extrabold">رده‌بندی {MONTHS[now.jm - 1]}</h2><span className="text-xs font-semibold text-mute">بر اساس درصد هدف ماه</span></div>

          <div className="relative mb-3 overflow-hidden rounded-hero p-5 text-white shadow-card" style={{ background: myRank === 1 ? "linear-gradient(135deg,#b7791f,#F5A028)" : "linear-gradient(135deg,#2A1B8C,rgb(var(--brand)))" }}>
            <div aria-hidden className="absolute -end-10 -top-14 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="text-5xl">{loadingBoards ? "⏳" : myRank === 1 ? "🏆" : "🎯"}</div>
              <div><p className="text-sm font-semibold text-white/80">رتبهٔ تو</p><p className="text-2xl font-extrabold">{fa(myRank)} از {fa(ranking.length)}</p>{gapText && <p className="mt-0.5 text-sm text-white/85">{gapText}</p>}</div>
            </div>
          </div>

          <ol className="space-y-2.5">
            {ranking.map((r, i) => {
              const body = (
                <>
                  <span className="w-7 shrink-0 text-center text-lg font-extrabold">{medal(i)}</span>
                  <Avatar email={r.email} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><p className="truncate font-bold">{r.label}{r.me && <span className="ms-1.5 rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-bold text-brand">من</span>}</p><span className="text-sm font-extrabold">{pctText(r.pct)}</span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, r.pct * 100)}%`, background: avatarColor(r.email) }} /></div>
                    <p className="mt-1 text-[11px] font-semibold text-mute">{r.failed ? "خواندن اطلاعات ممکن نشد" : r.total === 0 ? "عادتی برای نمایش ندارد" : `امروز ${fa(r.today)} از ${fa(r.total)} · ${fa(r.done)} تیک این ماه`}</p>
                  </div>
                  {r.href && <span className="text-mute">‹</span>}
                </>
              );
              const cls = `flex items-center gap-3 rounded-row p-3.5 shadow-card ${r.me ? "bg-brand/8 ring-1 ring-brand/30" : "bg-surface"}`;
              return <li key={r.key}>{r.href ? <Link href={r.href} className={`${cls} active:scale-[.99]`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ol>
          <p className="mt-3 text-center text-xs text-mute">روی هر دوست بزن تا جدول عادت‌هایش را ببینی</p>
        </section>
      )}

      {!f.loading && f.friends.length === 0 && f.incoming.length === 0 && (
        <div className="mt-6 rounded-hero border-2 border-dashed border-line p-7 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-soft text-3xl">🤝</div>
          <h2 className="text-lg font-extrabold">هنوز دوستی اضافه نکرده‌ای</h2>
          <p className="mx-auto mt-1 max-w-64 text-sm text-mute">با دیدن پیشرفت دوستت، انگیزهٔ ادامه دادن چند برابر می‌شود.</p>
          <button onClick={share} className="mt-4 rounded-2xl bg-soft px-5 py-3 text-sm font-bold text-brand active:scale-95">دعوت با لینک</button>
        </div>
      )}

      {/* درخواست‌های ارسالی */}
      {f.outgoing.length > 0 && (
        <section className="mt-7" aria-label="در انتظار پاسخ">
          <h2 className="mb-3 text-base font-extrabold text-mute">در انتظار پذیرش</h2>
          <ul className="space-y-2">
            {f.outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-row bg-surface/70 p-3 shadow-card">
                <Avatar email={r.to_email} size={36} />
                <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm font-semibold">{r.to_email}</span>
                <button onClick={() => f.remove(r.id)} className="rounded-xl bg-soft px-3 py-1.5 text-xs font-bold text-mute active:scale-95">لغو</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
