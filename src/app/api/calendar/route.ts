import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser, serverClient } from "@/lib/supabase-server";
import { authedClient, gfetch } from "@/lib/google";
import { todayISO } from "@/lib/jalali";
import { callAppsScript, isAppsScriptUrl } from "@/lib/apps-script";
import { nextDue, toCalendarRecurrence, toScriptRepeat } from "@/lib/recurrence";

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
 * POST { kind:'todo'|'habit', id, time?, date?, type?:'reminder'|'meeting', durationMinutes?:number, scriptUrl?, title?, name?, eventId? }
 * ثبت یا حذف یادآور و جلسه در تقویم گوگل و همگام‌سازی اطلاعات در Supabase
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let bodyData: any = {};
  try {
    bodyData = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    kind,
    id,
    time,
    date,
    type,
    durationMinutes,
    description,
    scriptUrl,
    title,
    name,
    eventId,
  } = bodyData;

  // User-scoped client: Row Level Security applies, so a request can only touch the caller's own rows.
  // Never use the service-role client here — it bypasses RLS and would let anyone edit anyone's rows by id.
  const db = serverClient();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  const table = kind === "habit" ? "habits" : "todos";
  const col = kind === "habit" ? "reminder_event_id" : "event_id";
  const timeCol = kind === "habit" ? "reminder_time" : "remind_time";

  // استخراج ردیف در صورت وجود در دیتابیس Supabase
  let row: any = null;
  if (id) {
    try {
      const { data } = await db.from(table).select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      row = data;
    } catch {}
  }

  const updateRow = async (patch: Record<string, any>) => {
    if (row && id) {
      try {
        await db.from(table).update(patch).eq("id", id).eq("user_id", user.id);
      } catch {}
    }
  };

  // عنوان و تاریخ هدف
  const fallbackTitle = kind === "habit" ? "عادت روزانه" : "کار روزانه";
  const rawTitle = (title || name || (row ? (kind === "habit" ? row.name : row.title) : "") || fallbackTitle).trim();
  // عادت: رویداد از اولین نوبتِ امروز به بعد شروع می‌شود، نه لزوماً خود امروز
  const habitFirst = kind === "habit" && row ? nextDue(row, todayISO()) : null;
  if (kind === "habit" && row && time && !habitFirst) {
    return NextResponse.json({ error: "این عادت نوبت آینده‌ای ندارد" }, { status: 400 });
  }
  const targetDate = date || (row ? (kind === "habit" ? habitFirst ?? todayISO() : row.day) : todayISO()) || todayISO();
  const oldEvId = eventId || (row ? row[col] : null);

  // بررسی آدرس اسکریپت تقویم کاربر: ابتدا از بدنه، سپس از کوکی، سپس از تنظیمات (فقط آدرس‌های script.google.com)
  let scriptUrlToUse = typeof scriptUrl === "string" ? scriptUrl.trim() : "";
  if (!scriptUrlToUse) {
    try {
      const cStore = cookies();
      scriptUrlToUse = cStore.get("calendar_script_url")?.value ? decodeURIComponent(cStore.get("calendar_script_url")!.value) : "";
    } catch {}
  }
  if (!scriptUrlToUse) {
    try {
      const { data: st } = await db.from("user_settings").select("script_url").eq("user_id", user.id).maybeSingle();
      scriptUrlToUse = st?.script_url || "";
    } catch {}
  }

  // Anything that is not a Google Apps Script web-app URL is ignored (no requests to arbitrary hosts).
  if (scriptUrlToUse && !isAppsScriptUrl(scriptUrlToUse)) scriptUrlToUse = "";

  const duration = Number(durationMinutes) > 0 ? Number(durationMinutes) : (type === "meeting" ? 45 : 30);
  const eventType = type === "meeting" ? "meeting" : "reminder";
  const summary = eventType === "meeting" ? `📅 جلسه: ${rawTitle}` : `🔔 یادآور: ${rawTitle}`;
  const desc = description || "ثبت‌شده از طریق اپ عادت‌ها و کارها";

  // ۱. عملیات حذف رویداد یا یادآور
  if (!time) {
    if (scriptUrlToUse) {
      if (oldEvId) {
        await callAppsScript(scriptUrlToUse, "calendar_delete", { eventId: oldEvId }).catch(() => null);
      }
    } else {
      const c = await authedClient(user.id).catch(() => null);
      if (c && oldEvId) {
        await gfetch(c, `${CAL}/${oldEvId}`, { method: "DELETE" }).catch(() => null);
      }
    }

    if (row) {
      const patch: Record<string, any> = { [col]: null, [timeCol]: null };
      if (kind === "todo") {
        patch.remind_date = null;
        patch.event_type = null;
        patch.duration_minutes = null;
      }
      await updateRow(patch);
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  // ۲. اولویت ۱: اتصال با اسکریپت تقویم گوگل (Google Apps Script)
  if (scriptUrlToUse) {
    try {
      const res = await callAppsScript(scriptUrlToUse, "calendar_create", {
        summary,
        date: targetDate,
        time: hhmm(time),
        type: eventType,
        durationMinutes: duration,
        oldEventId: oldEvId,
        description: desc,
        // عادت‌ها تکرار می‌شوند (همان برنامهٔ عادت)؛ کارها یک‌باره‌اند
        repeat: kind === "habit" ? toScriptRepeat(row?.recurrence, targetDate) : null,
      });

      if (!res.ok) {
        return NextResponse.json({ error: res.error || "خطا در ثبت رویداد در تقویم گوگل" }, { status: 500 });
      }

      if (row) {
        const patch: Record<string, any> = { [col]: res.eventId, [timeCol]: time };
        if (kind === "todo") {
          patch.remind_date = targetDate;
          patch.event_type = eventType;
          patch.duration_minutes = duration;
        }
        await updateRow(patch);
      }

      return NextResponse.json({
        ok: true,
        eventId: res.eventId,
        date: targetDate,
        time: hhmm(time),
        type: eventType,
        durationMinutes: duration,
        method: "apps_script",
        // اسکریپت قدیمی فیلد repeat را نادیده می‌گیرد و فقط یک رویداد می‌سازد
        oldScript: kind === "habit" && res.repeated !== true,
      });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }

  // ۳. اولویت ۲: استفاده از Google OAuth (در صورت اتصال)
  const c = await authedClient(user.id).catch(() => null);
  if (c) {
    try {
      const body: any = {
        summary,
        description: desc,
        start: { dateTime: `${targetDate}T${hhmm(time)}:00`, timeZone: TZ },
        end: { dateTime: `${targetDate}T${addMinutes(hhmm(time), duration)}:00`, timeZone: TZ },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: eventType === "meeting" ? 10 : 0 }],
        },
      };
      // تکرار رویداد همان برنامهٔ عادت است (قبلاً همیشه روزانه بود)
      if (kind === "habit") body.recurrence = toCalendarRecurrence(row?.recurrence, targetDate, hhmm(time));

      const ev = oldEvId
        ? await gfetch(c, `${CAL}/${oldEvId}`, { method: "PUT", body: JSON.stringify(body) }).catch(() =>
            gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) })
          )
        : await gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) });

      if (row) {
        const patch: Record<string, any> = { [col]: ev.id, [timeCol]: time };
        if (kind === "todo") {
          patch.remind_date = targetDate;
          patch.event_type = eventType;
          patch.duration_minutes = duration;
        }
        await updateRow(patch);
      }

      return NextResponse.json({
        ok: true,
        eventId: ev.id,
        date: targetDate,
        time: hhmm(time),
        type: eventType,
        durationMinutes: duration,
        method: "oauth",
      });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
    }
  }

  // ۴. در صورتی که اتصال مستقیم هنوز انجام نشده است:
  // تولید شناسه رویداد محلی و لینک وب اینتنت تقویم گوگل
  const cleanTime = hhmm(time);
  const startCompact = `${targetDate.replace(/-/g, "")}T${cleanTime.replace(":", "")}00`;
  const endHHMM = addMinutes(cleanTime, duration);
  const endCompact = `${targetDate.replace(/-/g, "")}T${endHHMM.replace(":", "")}00`;
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    summary
  )}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(desc)}&sf=true&output=xml`;

  if (row) {
    const patch: Record<string, any> = { [timeCol]: time };
    if (kind === "todo") {
      patch.remind_date = targetDate;
      patch.event_type = eventType;
      patch.duration_minutes = duration;
    }
    await updateRow(patch);
  }

  // تقویم وصل نیست: رویدادی ساخته نشده، پس شناسه‌ای هم برنمی‌گردد (قبلاً شناسهٔ ساختگی intent_ ذخیره می‌شد)
  return NextResponse.json({
    ok: true,
    notConnected: true,
    eventId: null,
    date: targetDate,
    time: cleanTime,
    type: eventType,
    durationMinutes: duration,
    calendarUrl,
    message: "یادآور ذخیره شد. برای همگام‌سازی ابری خودکار، آدرس اسکریپت تقویم را در صفحهٔ تنظیمات وارد کنید یا از لینک تقویم استفاده نمایید.",
  });
}
