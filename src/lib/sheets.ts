import type { OAuth2Client } from "google-auth-library";
import { gfetch } from "./google";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

/** چیدمان تب‌های ماهانه (دقیقاً مطابق شیت) */
export const L = {
  habitFirst: 11, habitLast: 25,      // B11:E25 → نام (B) و هدف (E)
  dayCol0: 6,                         // ستون G = اندیس ۶ (۰-مبنا)؛ روز ۱ تا ۳۰ → G..AJ
  weeklyFirst: 39, weeklyLast: 48,    // ۵ بلوک ۷ستونه: تیک در ستون اول، متن در ستون دوم
  monthlyFirst: 52, monthlyLast: 61,  // ۲ بلوک
  yearCell: "B6", monthCell: "D6", dailyTargetRow: 34,
};
export const colName = (i: number) => { let s = ""; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
export const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export type TabInfo = { sheetId: number; title: string; index: number };
export async function listTabs(c: OAuth2Client, id: string): Promise<TabInfo[]> {
  const r = await gfetch(c, `${API}/${id}?fields=sheets.properties(sheetId,title,index)`);
  return r.sheets.map((s: any) => s.properties);
}
export async function batchGet(c: OAuth2Client, id: string, ranges: string[]): Promise<any[][][]> {
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const r = await gfetch(c, `${API}/${id}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`);
  return r.valueRanges.map((v: any) => v.values ?? []);
}
export async function batchWrite(c: OAuth2Client, id: string, data: { range: string; values: any[][] }[]) {
  if (!data.length) return;
  await gfetch(c, `${API}/${id}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
}
export async function duplicateTab(c: OAuth2Client, id: string, src: TabInfo, title: string) {
  await gfetch(c, `${API}/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: src.index + 1, newSheetName: title } }] }),
  });
}
export const sheetIdFromUrl = (s: string) => s.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? s.trim();
