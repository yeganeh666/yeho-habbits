/**
 * اسکریپت اختصاصی اتصال به تقویم گوگل (Google Calendar)
 * بدون نیاز به Google Cloud Console، فقط با Apps Script اختصاصی تقویم
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * اسکریپت اتصال تقویم گوگل (Google Calendar) و خروجی Google Sheets
 * نسخهٔ ۳ — اگر نسخهٔ قبلی را نصب کرده‌اید، این کد را جایگزین کنید و
 * Deploy > Manage deployments > Edit > Version: New version را بزنید (آدرس عوض نمی‌شود).
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
      return jsonResponse({ ok: true, email: userEmail, version: 3, sheets: true, repeat: true });
    }

    // ۱-ب. خروجی یک‌طرفهٔ یک ماه به Google Sheets
    // فایل یک‌بار ساخته می‌شود و شناسه‌اش در Script Properties همین اسکریپت می‌ماند
    if (action === "sheets_export") {
      var values = body.values || [];
      var tab = String(body.tab || "Habits");
      var props = PropertiesService.getScriptProperties();
      var id = props.getProperty("EXPORT_SPREADSHEET_ID");
      var ss = null;
      if (id) {
        try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
      }
      var sh = null;
      if (!ss) {
        ss = SpreadsheetApp.create(body.title || "Yeho Habits");
        props.setProperty("EXPORT_SPREADSHEET_ID", ss.getId());
        sh = ss.getSheets()[0];
        sh.setName(tab);
      } else {
        sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
      }
      sh.clear();
      sh.setRightToLeft(true);
      if (values.length && values[0].length) {
        sh.getRange(1, 1, values.length, values[0].length).setValues(values);
        sh.getRange(1, 1, 1, values[0].length).setFontWeight("bold");
        sh.setFrozenRows(1);
        sh.setFrozenColumns(1);
      }
      return jsonResponse({ ok: true, url: ss.getUrl() + "#gid=" + sh.getSheetId() });
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
      if (body.oldEventId) deleteEventIds(cal, body.oldEventId);

      var prefix = eventType === "meeting" ? "📅 جلسه: " : "🔔 یادآور: ";
      var fullSummary = summary.indexOf("جلسه") >= 0 || summary.indexOf("یادآور") >= 0 ? summary : (prefix + summary);

      var rep = body.repeat || null;
      var minutesBefore = eventType === "meeting" ? 10 : 0;
      var opts = { description: desc };

      // تکرار ماهانهٔ شمسی: برای هر تاریخ یک رویداد؛ شناسه‌ها با ویرگول جدا می‌شوند
      if (rep && rep.freq === "dates") {
        var ids = [];
        for (var i = 0; i < rep.dates.length; i++) {
          var dp = rep.dates[i].split("-");
          var s2 = new Date(parseInt(dp[0], 10), parseInt(dp[1], 10) - 1, parseInt(dp[2], 10), hours, mins, 0);
          var e2 = new Date(s2.getTime() + duration * 60 * 1000);
          var ev2 = cal.createEvent(fullSummary, s2, e2, opts);
          setReminder(ev2, minutesBefore);
          ids.push(ev2.getId());
        }
        return jsonResponse({ ok: true, eventId: ids.join(","), repeated: true });
      }

      // تکرار روزانه یا هفتگی: یک رویداد تکرارشونده
      if (rep && (rep.freq === "daily" || rep.freq === "weekly")) {
        var recurrence = CalendarApp.newRecurrence();
        var rule = rep.freq === "daily" ? recurrence.addDailyRule() : recurrence.addWeeklyRule();
        rule.interval(rep.interval || 1);
        if (rep.freq === "weekly" && rep.weekdays && rep.weekdays.length) {
          var wd = [];
          for (var k = 0; k < rep.weekdays.length; k++) wd.push(CalendarApp.Weekday[rep.weekdays[k]]);
          rule.onlyOnWeekdays(wd);
        }
        if (rep.until) {
          var up = rep.until.split("-");
          rule.until(new Date(parseInt(up[0], 10), parseInt(up[1], 10) - 1, parseInt(up[2], 10), 23, 59, 59));
        }
        var series = cal.createEventSeries(fullSummary, start, end, recurrence, opts);
        setReminder(series, minutesBefore);
        return jsonResponse({ ok: true, eventId: series.getId(), repeated: true });
      }

      var event = cal.createEvent(fullSummary, start, end, opts);
      setReminder(event, minutesBefore);
      return jsonResponse({ ok: true, eventId: event.getId() });
    }

    // ۳. حذف رویداد از تقویم
    if (action === "calendar_delete") {
      var cal = CalendarApp.getDefaultCalendar();
      if (body.eventId) deleteEventIds(cal, body.eventId);
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

// حذف یک یا چند شناسه (جداشده با ویرگول)؛ سری‌های تکرارشونده کامل حذف می‌شوند
function deleteEventIds(cal, idList) {
  var ids = String(idList).split(",");
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i].replace(/^\s+|\s+$/g, "");
    if (!id) continue;
    try {
      var series = cal.getEventSeriesById(id);
      if (series) { series.deleteEventSeries(); continue; }
    } catch (e) {}
    try {
      var ev = cal.getEventById(id);
      if (ev) ev.deleteEvent();
    } catch (e2) {}
  }
}

function setReminder(ev, minutesBefore) {
  try {
    ev.removeAllReminders();
    ev.addPopupReminder(minutesBefore);
  } catch (e) {}
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

/**
 * Only Google Apps Script web-app URLs are allowed, so the server can never be
 * used to send requests to arbitrary or internal addresses (SSRF).
 * Accepts https://script.google.com/macros/s/<id>/exec and the Workspace form
 * https://script.google.com/a/macros/<domain>/s/<id>/exec
 */
export function isAppsScriptUrl(raw?: string | null): boolean {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.hostname !== "script.google.com" || u.port || u.username || u.password) return false;
  return /^\/(a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname);
}

export async function callAppsScript(scriptUrl: string, action: string, data: Record<string, any> = {}): Promise<any> {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl) throw new Error("آدرس اسکریپت تقویم گوگل وارد نشده است.");
  if (!isAppsScriptUrl(cleanUrl)) {
    throw new Error("آدرس اسکریپت معتبر نیست؛ باید با https://script.google.com/macros/s/ شروع شود و به /exec ختم شود.");
  }
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
