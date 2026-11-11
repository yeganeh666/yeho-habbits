import { NextResponse } from "next/server";
import { currentUser, serverClient } from "@/lib/supabase-server";
import { callAppsScript, isAppsScriptUrl } from "@/lib/apps-script";
import { fa, monthLength, monthRange, MONTHS, toISO } from "@/lib/jalali";
import { dueCount, isDue, type Recurrence } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

type HabitRow = {
  id: string;
  name: string;
  archived: boolean;
  monthly_target: number | null;
  recurrence: Recurrence | null;
  created_at: string;
};

/**
 * POST { jy, jm, scriptUrl? }
 * خروجی یک‌طرفهٔ یک ماه شمسی به Google Sheets (ADR-001، گزینهٔ B) از طریق
 * همان Apps Script کاربر — بدون نیاز به Google Cloud Console یا OAuth.
 * پایگاه داده تنها منبع داده است: هر بار برگهٔ آن ماه از نو نوشته می‌شود و
 * تغییرات داخل شیت به اپ برنمی‌گردد.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const jy = Number(body.jy), jm = Number(body.jm);
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || jy < 1300 || jy > 1500 || jm < 1 || jm > 12) {
    return NextResponse.json({ error: "ماه نامعتبر است" }, { status: 400 });
  }

  const db = serverClient();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  // ---------- داده‌های ماه (با RLS، فقط داده‌های خود کاربر) ----------
  const { start, end } = monthRange(jy, jm);
  const len = monthLength(jy, jm);

  const [hRes, tRes, sRes] = await Promise.all([
    db.from("habits").select("id,name,archived,monthly_target,recurrence,created_at").order("sort").order("created_at"),
    db.from("habit_targets").select("habit_id,target").eq("jy", jy).eq("jm", jm),
    db.from("user_settings").select("script_url").eq("user_id", user.id).maybeSingle(),
  ]);
  if (hRes.error) return NextResponse.json({ error: hRes.error.message }, { status: 500 });

  // آدرس اسکریپت: از بدنه (ذخیره‌شده در مرورگر) یا تنظیمات؛ فقط script.google.com
  const fromBody = typeof body.scriptUrl === "string" ? body.scriptUrl.trim() : "";
  const scriptUrl = [fromBody, sRes.data?.script_url ?? ""].find((u) => isAppsScriptUrl(u)) ?? "";
  if (!scriptUrl) {
    return NextResponse.json(
      { error: "not_connected", message: "ابتدا آدرس اسکریپت گوگل را در بخش تقویم همین صفحه ذخیره کنید" },
      { status: 400 }
    );
  }

  const done = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("habit_logs")
      .select("habit_id,day")
      .eq("done", true)
      .gte("day", start)
      .lte("day", end)
      .order("day")
      .order("habit_id")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    (data ?? []).forEach((l: any) => done.add(`${l.habit_id}|${l.day}`));
    if (!data || data.length < 1000) break;
  }

  const targets = new Map<string, number>((tRes.data ?? []).map((t: any) => [t.habit_id, t.target]));
  const days = Array.from({ length: len }, (_, i) => toISO({ jy, jm, jd: i + 1 }));
  const habits = ((hRes.data ?? []) as HabitRow[]).filter(
    (h) => !h.archived || days.some((d) => done.has(`${h.id}|${d}`))
  );

  // ---------- جدول: یک ردیف برای هر عادت، یک ستون برای هر روز ----------
  const header = ["عادت", ...days.map((_, i) => fa(i + 1)), "انجام‌شده", "هدف", "درصد"];
  const rows = habits.map((h) => {
    const cells = days.map((d) => (done.has(`${h.id}|${d}`) ? "✓" : isDue(h, d) ? "" : "–"));
    // مثل اپ: برای عادت دارای تکرار فقط روزهای نوبت شمرده می‌شوند
    const count = days.filter((d) => done.has(`${h.id}|${d}`) && (!h.recurrence || isDue(h, d))).length;
    const target = h.recurrence ? dueCount(h, jy, jm) : targets.get(h.id) ?? h.monthly_target ?? len;
    const pct = target > 0 ? Math.round((count / target) * 100) : 0;
    return [h.name, ...cells, count, target, pct];
  });
  const values = [header, ...rows];

  const tab = `${MONTHS[jm - 1]} ${fa(jy)}`;

  try {
    const res = await callAppsScript(scriptUrl, "sheets_export", {
      title: "Yeho Habits — خروجی عادت‌ها",
      tab,
      values,
    });
    if (!res?.ok) {
      const err = String(res?.error ?? "");
      // نسخهٔ قدیمی اسکریپت این عملیات را نمی‌شناسد
      if (err.includes("sheets_export")) {
        return NextResponse.json(
          { error: "old_script", message: "اسکریپت گوگل قدیمی است؛ کد جدید را از همین صفحه کپی کنید و با «New version» دوباره Deploy کنید" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "script", message: err.slice(0, 300) || "اسکریپت گوگل پاسخ معتبری نداد" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, habits: habits.length, url: res.url });
  } catch (e: any) {
    return NextResponse.json({ error: "script", message: String(e?.message ?? e).slice(0, 300) }, { status: 502 });
  }
}
