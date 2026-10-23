import { NextResponse } from "next/server";
import { adminClient, currentUser } from "@/lib/supabase-server";
import { authedClient, gfetch } from "@/lib/google";
import { todayISO } from "@/lib/jalali";
import { callAppsScript } from "@/lib/apps-script";

export const dynamic = "force-dynamic";
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TZ = "Asia/Tehran";
const hhmm = (t: string) => t.slice(0, 5);
const addMinutes = (t: string, mins: number) => {
  const [h, m] = t.split(":").map(Number);
  const x = h * 60 + m + mins;
  return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

/**
 * POST { kind:'todo'|'habit', id, time?, date?, type?:'reminder'|'meeting', durationMinutes?:number, scriptUrl? }
 * ثبت یا حذف یادآور و جلسه در تقویم گوگل و ذخیره وضعیت در Supabase
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind, id, time, date, type, durationMinutes, description, scriptUrl } = await req.json();
  const db = adminClient();

  const table = kind === "habit" ? "habits" : "todos";
  const col = kind === "habit" ? "reminder_event_id" : "event_id";
  const timeCol = kind === "habit" ? "reminder_time" : "remind_time";

  const { data: row } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // بررسی آدرس اسکریپت تقویم کاربر
  let scriptUrlToUse = scriptUrl;
  if (!scriptUrlToUse) {
    const { data: st } = await db.from("user_settings").select("script_url").eq("user_id", user.id).maybeSingle();
    scriptUrlToUse = st?.script_url;
  }

  const duration = Number(durationMinutes) > 0 ? Number(durationMinutes) : (type === "meeting" ? 45 : 30);
  const eventType = type === "meeting" ? "meeting" : "reminder";

  // اولویت ۱: اتصال با اسکریپت تقویم گوگل (Google Apps Script)
  if (scriptUrlToUse && scriptUrlToUse.trim()) {
    try {
      if (!time) {
        if (row[col]) {
          await callAppsScript(scriptUrlToUse, "calendar_delete", { eventId: row[col] }).catch(() => null);
        }
        const patch: Record<string, any> = { [col]: null, [timeCol]: null };
        if (kind === "todo") {
          patch.remind_date = null;
          patch.event_type = null;
          patch.duration_minutes = null;
        }
        await db.from(table).update(patch).eq("id", id);
        return NextResponse.json({ ok: true });
      }

      const targetDate = date || (kind === "habit" ? todayISO() : row.day) || todayISO();
      const rawTitle = (kind === "habit" ? row.name : row.title).trim();
      const summary = eventType === "meeting" ? `📅 جلسه: ${rawTitle}` : `🔔 یادآور: ${rawTitle}`;

      const res = await callAppsScript(scriptUrlToUse, "calendar_create", {
        summary,
        date: targetDate,
        time: hhmm(time),
        type: eventType,
        durationMinutes: duration,
        oldEventId: row[col] || null,
        description: description || "ثبت‌شده از طریق اپ عادت‌ها و کارها",
      });

      if (!res.ok) {
        return NextResponse.json({ error: res.error || "خطا در ثبت رویداد در تقویم" }, { status: 500 });
      }

      const patch: Record<string, any> = { [col]: res.eventId, [timeCol]: time };
      if (kind === "todo") {
        patch.remind_date = targetDate;
        patch.event_type = eventType;
        patch.duration_minutes = duration;
      }
      await db.from(table).update(patch).eq("id", id);

      return NextResponse.json({ ok: true, eventId: res.eventId, date: targetDate });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }

  // اولویت ۲: استفاده از Google OAuth (در صورت اتصال)
  const c = await authedClient(user.id);
  if (!c) {
    return NextResponse.json({
      error: "not_connected",
      message: "ابتدا در صفحه تنظیمات، تقویم گوگل را متصل کنید."
    }, { status: 400 });
  }

  try {
    if (!time) {
      if (row[col]) await gfetch(c, `${CAL}/${row[col]}`, { method: "DELETE" }).catch(() => null);
      const patch: Record<string, any> = { [col]: null, [timeCol]: null };
      if (kind === "todo") {
        patch.remind_date = null;
        patch.event_type = null;
        patch.duration_minutes = null;
      }
      await db.from(table).update(patch).eq("id", id);
      return NextResponse.json({ ok: true });
    }

    const targetDate = date || (kind === "habit" ? todayISO() : row.day) || todayISO();
    const rawTitle = (kind === "habit" ? row.name : row.title).trim();
    const summary = eventType === "meeting" ? `📅 جلسه: ${rawTitle}` : `🔔 یادآور: ${rawTitle}`;

    const body: any = {
      summary,
      description: description || "ثبت‌شده از طریق اپ عادت‌ها و کارها",
      start: { dateTime: `${targetDate}T${hhmm(time)}:00`, timeZone: TZ },
      end: { dateTime: `${targetDate}T${addMinutes(hhmm(time), duration)}:00`, timeZone: TZ },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: eventType === "meeting" ? 10 : 0 }],
      },
    };
    if (kind === "habit") body.recurrence = ["RRULE:FREQ=DAILY"];

    const ev = row[col]
      ? await gfetch(c, `${CAL}/${row[col]}`, { method: "PUT", body: JSON.stringify(body) }).catch(() =>
          gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) })
        )
      : await gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) });

    const patch: Record<string, any> = { [col]: ev.id, [timeCol]: time };
    if (kind === "todo") {
      patch.remind_date = targetDate;
      patch.event_type = eventType;
      patch.duration_minutes = duration;
    }
    await db.from(table).update(patch).eq("id", id);

    return NextResponse.json({ ok: true, eventId: ev.id, date: targetDate });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
