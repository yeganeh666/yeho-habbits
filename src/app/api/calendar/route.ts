import { NextResponse } from "next/server";
import { adminClient, currentUser } from "@/lib/supabase-server";
import { authedClient, gfetch } from "@/lib/google";
import { addDays, todayISO } from "@/lib/jalali";

export const dynamic = "force-dynamic";
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TZ = "Asia/Tehran";
const hhmm = (t: string) => t.slice(0, 5);
const plus30 = (t: string) => { const [h, m] = t.split(":").map(Number); const x = h * 60 + m + 30; return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

/** POST {kind:'todo'|'habit', id, time?}  → رویداد با یادآور پاپ‌آپ می‌سازد/به‌روز می‌کند.  time=null → رویداد حذف می‌شود. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind, id, time } = await req.json();
  const db = adminClient();
  const c = await authedClient(user.id);
  if (!c) return NextResponse.json({ error: "not_connected" }, { status: 400 });
  const table = kind === "habit" ? "habits" : "todos";
  const col = kind === "habit" ? "reminder_event_id" : "event_id";
  const timeCol = kind === "habit" ? "reminder_time" : "remind_time";
  const { data: row } = await db.from(table).select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    if (!time) {
      if (row[col]) await gfetch(c, `${CAL}/${row[col]}`, { method: "DELETE" }).catch(() => null);
      await db.from(table).update({ [col]: null, [timeCol]: null }).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    const day = kind === "habit" ? todayISO() : row.day;
    const body: any = {
      summary: kind === "habit" ? `✅ ${row.name}` : `📝 ${row.title}`,
      description: "ساخته‌شده توسط اپ عادت‌ها",
      start: { dateTime: `${day}T${hhmm(time)}:00`, timeZone: TZ },
      end: { dateTime: `${day}T${plus30(hhmm(time))}:00`, timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
    };
    if (kind === "habit") body.recurrence = ["RRULE:FREQ=DAILY"];
    const ev = row[col]
      ? await gfetch(c, `${CAL}/${row[col]}`, { method: "PUT", body: JSON.stringify(body) }).catch(() => gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) }))
      : await gfetch(c, CAL, { method: "POST", body: JSON.stringify(body) });
    await db.from(table).update({ [col]: ev.id, [timeCol]: time }).eq("id", id);
    return NextResponse.json({ ok: true, eventId: ev.id });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
