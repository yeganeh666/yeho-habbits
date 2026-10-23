/**
 * اسکریپت اختصاصی اتصال به تقویم گوگل (Google Calendar)
 * بدون نیاز به Google Cloud Console، فقط با Apps Script اختصاصی تقویم
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * اسکریپت اتصال تقویم گوگل (Google Calendar)
 * 
 * نحوه نصب:
 * ۱. وارد https://script.new شوید (یا script.google.com).
 * ۲. کد زیر را به جای محتوای ویرایشگر قرار دهید و Save (ذخیره) را بزنید.
 * ۳. از بالا روی دکمه آبی Deploy (استقرار) > New deployment (استقرار جدید) کلیک کنید.
 * ۴. نوع پروژه را Web app انتخاب کنید.
 * ۵. Execute as: Me (من)
 * ۶. Who has access: Anyone (هر کسی)
 * ۷. دکمه Deploy را بزنید، دسترسی تقویم را تأیید کرده و آدرس Web App را کپی کنید.
 */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var body = JSON.parse(raw);
    var action = body.action;

    // ۱. تست اتصال
    if (action === "test") {
      var userEmail = Session.getActiveUser().getEmail() || "connected";
      return jsonResponse({ ok: true, email: userEmail });
    }

    // ۲. ایجاد یا ویرایش یادآور یا جلسه در تقویم
    if (action === "calendar_create") {
      var cal = CalendarApp.getDefaultCalendar();
      var summary = body.summary || "یادآور";
      var dateStr = body.date; // YYYY-MM-DD
      var timeStr = body.time || "09:00"; // HH:MM
      var desc = body.description || "ثبت‌شده توسط اپ عادت‌ها";
      var duration = body.durationMinutes ? parseInt(body.durationMinutes, 10) : 30;
      var eventType = body.type || "reminder"; // "reminder" | "meeting"

      var dParts = dateStr.split("-");
      var tParts = timeStr.split(":");
      var year = parseInt(dParts[0], 10);
      var month = parseInt(dParts[1], 10) - 1;
      var day = parseInt(dParts[2], 10);
      var hours = parseInt(tParts[0], 10);
      var mins = parseInt(tParts[1], 10);

      var start = new Date(year, month, day, hours, mins, 0);
      var end = new Date(start.getTime() + duration * 60 * 1000);

      // اگر قبلاً رویدادی ساخته شده بود، حذفش کن تا جدید جایگزین شود
      if (body.oldEventId) {
        try {
          var oldEv = cal.getEventById(body.oldEventId);
          if (oldEv) oldEv.deleteEvent();
        } catch (e) {}
      }

      var prefix = eventType === "meeting" ? "📅 جلسه: " : "🔔 یادآور: ";
      var fullSummary = summary.indexOf("جلسه") >= 0 || summary.indexOf("یادآور") >= 0 ? summary : (prefix + summary);

      var event = cal.createEvent(fullSummary, start, end, { description: desc });
      try {
        event.removeAllReminders();
        if (eventType === "meeting") {
          event.addPopupReminder(10); // ۱۰ دقیقه قبل از جلسه
        } else {
          event.addPopupReminder(0); // دقیقاً در زمان یادآور
        }
      } catch (e) {}

      return jsonResponse({ ok: true, eventId: event.getId() });
    }

    // ۳. حذف رویداد از تقویم
    if (action === "calendar_delete") {
      var cal = CalendarApp.getDefaultCalendar();
      if (body.eventId) {
        try {
          var ev = cal.getEventById(body.eventId);
          if (ev) ev.deleteEvent();
        } catch (e) {}
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "عملیات ناشناخته: " + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doGet(e) {
  return jsonResponse({
    ok: true,
    status: "active",
    message: "اسکریپت تقویم گوگل فعال است."
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export async function callAppsScript(scriptUrl: string, action: string, data: Record<string, any> = {}): Promise<any> {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl) throw new Error("آدرس اسکریپت تقویم گوگل وارد نشده است.");
  const payload = { action, ...data };
  const res = await fetch(cleanUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`خطای اسکریپت تقویم (${res.status}): ${text.slice(0, 150)}`);
  }
  return await res.json();
}
