import { NextResponse } from "next/server";
import { currentUser, serverClient } from "@/lib/supabase-server";
import { authedClient, gfetch } from "@/lib/google";
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
 * POST { jy, jm }
 * خروجی یک‌طرفهٔ یک ماه شمسی به Google Sheets (ADR-001، گزینهٔ B).
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

  const google = await authedClient(user.id).catch(() => null);
  if (!google) {
    return NextResponse.json({ error: "not_connected", message: "ابتدا حساب گوگل را از همین بخش وصل کنید" }, { status: 400 });
  }

  // ---------- داده‌های ماه (با RLS، فقط داده‌های خود کاربر) ----------
  const { start, end } = monthRange(jy, jm);
  const len = monthLength(jy, jm);

  const [hRes, tRes, sRes] = await Promise.all([
    db.from("habits").select("id,name,archived,monthly_target,recurrence,created_at").order("sort").order("created_at"),
    db.from("habit_targets").select("habit_id,target").eq("jy", jy).eq("jm", jm),
    db.from("user_settings").select("export_spreadsheet_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (hRes.error) return NextResponse.json({ error: hRes.error.message }, { status: 500 });
  if (sRes.error && sRes.error.message.includes("export_spreadsheet_id")) {
    return NextResponse.json(
      { error: "schema", message: "ابتدا فایل supabase/2026-11-sheets-export.sql را در Supabase اجرا کنید" },
      { status: 500 }
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
    // ---------- فایل و برگهٔ ماه ----------
    let spreadsheetId: string | null = sRes.data?.export_spreadsheet_id ?? null;
    let sheetId: number | null = null;

    if (spreadsheetId) {
      const meta = await gfetch(google, `${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`).catch(
        (e: Error) => {
          // فایل حذف شده یا دیگر در دسترس نیست → فایل تازه ساخته می‌شود
          if (/Google (403|404)/.test(e.message)) return null;
          throw e;
        }
      );
      if (!meta) spreadsheetId = null;
      else sheetId = meta.sheets?.find((s: any) => s.properties?.title === tab)?.properties?.sheetId ?? null;
    }

    if (!spreadsheetId) {
      const created = await gfetch(google, SHEETS, {
        method: "POST",
        body: JSON.stringify({
          properties: { title: "Yeho Habits — خروجی عادت‌ها", locale: "fa_IR", timeZone: "Asia/Tehran" },
          sheets: [{ properties: { title: tab, rightToLeft: true } }],
        }),
      });
      spreadsheetId = created.spreadsheetId as string;
      sheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;
      await db.from("user_settings").upsert({ user_id: user.id, export_spreadsheet_id: spreadsheetId }, { onConflict: "user_id" });
    } else if (sheetId === null) {
      const added = await gfetch(google, `${SHEETS}/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, rightToLeft: true } } }] }),
      });
      sheetId = added.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    } else {
      await gfetch(google, `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: "POST", body: "{}" });
    }

    // ---------- نوشتن ----------
    await gfetch(
      google,
      `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) }
    );
    if (sheetId !== null) {
      await gfetch(google, `${SHEETS}/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } },
                fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
              },
            },
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
          ],
        }),
      }).catch(() => null); // قالب‌بندی اختیاری است؛ خطای آن نباید خروجی را خراب کند
    }

    return NextResponse.json({
      ok: true,
      habits: habits.length,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${sheetId !== null ? `#gid=${sheetId}` : ""}`,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/Google (401|403)/.test(msg)) {
      // توکن‌های قدیمی فقط دسترسی تقویم دارند؛ باید یک‌بار دوباره وصل شوند
      return NextResponse.json(
        { error: "reconnect", message: "دسترسی گوگل کافی نیست؛ یک‌بار دیگر حساب گوگل را وصل کنید" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
  }
}
