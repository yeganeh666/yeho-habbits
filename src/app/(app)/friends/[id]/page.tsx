"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fa, fromISO, monthLength, MONTHS, shiftMonth, toISO, todayISO, WEEKDAYS_SHORT, weekdayIndex } from "@/lib/jalali";
import { useMonth } from "@/lib/data";
import { nameOf, useFriendBoard, useFriends } from "@/lib/friends";
import { Donut, pctText } from "@/components/ui";
import { Avatar } from "@/components/avatar";

const Chevron = ({ dir }: { dir: "l" | "r" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={dir === "r" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} /></svg>
);
type TRow = { id: string; name: string; color: string; count: number; target: number; isDone: (d: string) => boolean };

export default function FriendBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const now = fromISO(todayISO());
  const today = todayISO();
  const [ym, setYm] = useState({ jy: now.jy, jm: now.jm });
  const [withMe, setWithMe] = useState(true);
  const [confirm, setConfirm] = useState(false);

  const f = useFriends();
  const friend = f.friends.find((x) => x.userId === id);
  const fb = useFriendBoard(friend ? id : null, ym.jy, ym.jm);
  const mine = useMonth(ym.jy, ym.jm);

  const len = monthLength(ym.jy, ym.jm);
  const days = Array.from({ length: len }, (_, i) => i + 1);
  const iso = (d: number) => toISO({ ...ym, jd: d });
  const myActive = mine.habits.filter((h) => !h.archived);
  const myDone = myActive.reduce((s, h) => s + mine.countOf(h.id), 0), myTarget = myActive.reduce((s, h) => s + mine.targetOf(h), 0);
  const myPct = myTarget ? myDone / myTarget : 0;
  const name = friend ? nameOf(friend.email) : "";

  const friendRows: TRow[] = fb.habits.map((h) => ({ id: h.id, name: h.name, color: h.color, count: fb.countOf(h.id), target: fb.targetOf(h), isDone: (d) => fb.isDone(h.id, d) }));
  const myRows: TRow[] = myActive.map((h) => ({ id: h.id, name: h.name, color: h.color, count: mine.countOf(h.id), target: mine.targetOf(h), isDone: (d) => mine.isDone(h.id, d) }));
  const dayPct = (d: number) => (fb.habits.length ? fb.habits.filter((h) => fb.isDone(h.id, iso(d))).length / fb.habits.length : 0);

  if (!f.loading && !friend) {
    return (
      <main className="mx-auto max-w-xl py-16 text-center">
        <p className="text-mute">این دوست پیدا نشد یا دوستی تأیید نشده است.</p>
        <Link href="/friends" className="mt-4 inline-block rounded-2xl bg-soft px-5 py-3 font-bold text-brand">بازگشت به دوستان</Link>
      </main>
    );
  }

  const diff = fb.pct - myPct;
  const verdict = fb.habits.length === 0 ? "" : Math.abs(diff) < 0.02 ? "کاملاً مساوی هستید! 🤝" : diff > 0 ? `${name} ${fa(Math.round(diff * 100))}٪ جلوتر است` : `تو ${fa(Math.round(-diff * 100))}٪ جلوتری 🎉`;

  return (
    <main className="mx-auto max-w-xl">
      <header className="mb-5 flex items-center gap-3">
        <Link href="/friends" aria-label="بازگشت" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card active:scale-95"><Chevron dir="r" /></Link>
        {friend && <Avatar email={friend.email} size={42} />}
        <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-extrabold">{name || "…"}</h1><p dir="ltr" className="truncate text-start text-xs text-mute">{friend?.email}</p></div>
      </header>

      {/* ناوبری ماه */}
      <div className="mb-4 flex items-center justify-center gap-1.5">
        <button aria-label="ماه قبل" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card active:scale-95" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, -1))}><Chevron dir="r" /></button>
        <h2 className="min-w-36 text-center text-lg font-extrabold">{MONTHS[ym.jm - 1]} {fa(ym.jy)}</h2>
        <button aria-label="ماه بعد" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-card active:scale-95" onClick={() => setYm(shiftMonth(ym.jy, ym.jm, 1))}><Chevron dir="l" /></button>
      </div>

      {/* رودررو */}
      <section className="relative overflow-hidden rounded-hero p-5 text-white shadow-card" style={{ background: "linear-gradient(135deg,#2A1B8C 0%,rgb(var(--brand)) 70%,rgb(var(--plum)) 130%)" }}>
        <div aria-hidden className="absolute -end-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-around">
          {[{ l: "تو", p: myPct, c: "rgba(255,255,255,.9)" }, { l: name || "دوست", p: fb.pct, c: "rgb(var(--amber))" }].map((x, i) => (
            <div key={i} className="text-center">
              <Donut pct={x.p} size={92} stroke={10} color={x.c}><span className="text-lg font-extrabold">{pctText(x.p)}</span></Donut>
              <p className="mt-2 max-w-24 truncate text-sm font-bold">{x.l}</p>
            </div>
          ))}
        </div>
        {verdict && <p className="relative mt-4 rounded-2xl bg-white/14 py-2.5 text-center text-sm font-bold">{verdict}</p>}
      </section>

      {fb.error && <p role="alert" className="mt-4 rounded-2xl bg-[#E5484D]/10 p-3.5 text-sm font-semibold text-[#E5484D]">{fb.error}</p>}

      {/* جدول */}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">جدول عادت‌ها</h2>
        <button role="switch" aria-checked={withMe} onClick={() => setWithMe(!withMe)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${withMe ? "bg-brand text-white" : "bg-soft text-brand"}`}>{withMe ? "✓ مقایسه با من" : "مقایسه با من"}</button>
      </div>

      <section aria-label="جدول عادت‌های دوست" className="overflow-hidden rounded-hero bg-surface shadow-card">
        <p className="px-4 pt-3 text-xs font-semibold text-mute">فقط مشاهده · برای دیدن همهٔ روزها به کنار بکش ›</p>
        <div className="no-scrollbar overflow-x-auto">
          <table className="border-separate border-spacing-0 text-center">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 min-w-36 bg-surface p-3 text-start text-sm font-bold text-mute">عادت</th>
                {days.map((d) => {
                  const on = iso(d) === today;
                  return (
                    <th key={d} className={`px-0.5 pb-2 pt-3 ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
                      <div className={`mx-auto w-8 rounded-xl py-1 ${on ? "bg-brand text-white" : ""}`}>
                        <div className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-mute"}`}>{WEEKDAYS_SHORT[weekdayIndex(iso(d))]}</div>
                        <div className="text-sm font-extrabold">{fa(d)}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <Section title={name ? `عادت‌های ${name}` : "عادت‌ها"} len={len} />
              {fb.loading ? <tr><td className="p-6 text-mute" colSpan={len + 1}>در حال بارگذاری…</td></tr> : friendRows.length === 0 ? (
                <tr><td className="p-6 text-sm text-mute" colSpan={len + 1}>عادتی برای نمایش وجود ندارد (یا همه پنهان شده‌اند).</td></tr>
              ) : friendRows.map((r) => <Row key={r.id} r={r} days={days} iso={iso} today={today} />)}
              {!fb.loading && friendRows.length > 0 && (
                <tr>
                  <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start text-xs font-bold text-mute">پیشرفت روز</th>
                  {days.map((d) => { const p = dayPct(d); return <td key={d} className={`px-0.5 pb-3 pt-1 align-bottom ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}><div title={pctText(p)} className="mx-auto flex h-10 w-8 items-end overflow-hidden rounded-lg bg-soft"><div className="w-full rounded-lg bg-mint" style={{ height: `${p * 100}%` }} /></div></td>; })}
                </tr>
              )}
              {withMe && (<>
                <Section title="عادت‌های تو" len={len} />
                {myRows.length === 0 ? <tr><td className="p-5 text-sm text-mute" colSpan={len + 1}>تو هنوز عادتی نساخته‌ای.</td></tr> : myRows.map((r) => <Row key={r.id} r={r} days={days} iso={iso} today={today} />)}
              </>)}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 text-center">
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="text-sm font-bold text-[#E5484D]">حذف از دوستان</button>
        ) : (
          <div className="rounded-2xl bg-[#E5484D]/10 p-4">
            <p className="text-sm font-semibold">دیگر جدول همدیگر را نمی‌بینید. مطمئنی؟</p>
            <div className="mt-3 flex justify-center gap-2">
              <button onClick={async () => { if (friend) await f.remove(friend.rowId); router.replace("/friends"); }} className="rounded-xl bg-[#E5484D] px-5 py-2 text-sm font-bold text-white active:scale-95">بله، حذف شود</button>
              <button onClick={() => setConfirm(false)} className="rounded-xl bg-surface px-5 py-2 text-sm font-bold text-mute active:scale-95">انصراف</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ title, len }: { title: string; len: number }) {
  return (
    <tr>
      <th className="sticky start-0 z-10 bg-bg px-3 py-1.5 text-start text-xs font-extrabold text-brand">{title}</th>
      <td colSpan={len} className="bg-bg" />
    </tr>
  );
}

function Row({ r, days, iso, today }: { r: TRow; days: number[]; iso: (d: number) => string; today: string }) {
  return (
    <tr>
      <th scope="row" className="sticky start-0 z-10 bg-surface p-3 text-start">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} /><span className="max-w-28 truncate text-sm font-bold">{r.name.trim()}</span></span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-2 w-12 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, r.target ? (r.count / r.target) * 100 : 0)}%`, background: r.color }} /></span>
          <span className="text-[11px] font-semibold text-mute">{fa(r.count)}/{fa(r.target)}</span>
        </span>
      </th>
      {days.map((d) => {
        const on = r.isDone(iso(d)), isToday = iso(d) === today;
        return (
          <td key={d} className={`p-0.5 ${d % 7 === 1 && d > 1 ? "ps-3" : ""}`}>
            <div aria-label={`${r.name.trim()} روز ${fa(d)}: ${on ? "انجام شده" : "انجام نشده"}`} className="mx-auto grid h-8 w-8 place-items-center rounded-[10px]" style={{ background: on ? r.color : "rgb(var(--soft))", boxShadow: isToday && !on ? `inset 0 0 0 2px ${r.color}88` : undefined }}>
              {on && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </div>
          </td>
        );
      })}
    </tr>
  );
}
