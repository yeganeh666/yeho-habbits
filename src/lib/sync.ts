import { adminClient } from "./supabase-server";
import { authedClient } from "./google";
import { L, batchGet, batchWrite, colName, duplicateTab, listTabs, qt } from "./sheets";
import { MONTHS, fromISO, monthLength, monthRange, todayISO, toISO } from "./jalali";

const t = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);

export type SyncResult = { status: string; pushed?: number; pulled?: number; message?: string };

/** همگام‌سازی یک ماه: اول تغییرات اپ (pending) روی شیت نوشته می‌شود، بعد شیت با دیتابیس مقایسه و به‌روز می‌شود. */
export async function syncMonth(userId: string, jy: number, jm: number): Promise<SyncResult> {
  const db = adminClient();
  const { data: st } = await db.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (!st?.sheet_id) return { status: "no_sheet" };
  const c = await authedClient(userId);
  if (!c) return { status: "not_connected" };

  const sheetId: string = st.sheet_id;
  const prefix = t(st.tab_prefix);
  const tabTitle = `${prefix} - ${MONTHS[jm - 1]}`;
  const { start, end } = monthRange(jy, jm);
  const len = Math.min(monthLength(jy, jm), 30); // شیت فقط ۳۰ ستون روز دارد

  const [hq, lq, gq] = await Promise.all([
    db.from("habits").select("*").eq("user_id", userId).order("sort").order("created_at"),
    db.from("habit_logs").select("*").eq("user_id", userId).gte("day", start).lte("day", end),
    db.from("goals").select("*").eq("user_id", userId).eq("jy", jy).eq("jm", jm),
  ]);
  const habits: any[] = hq.data ?? [];
  const logs: any[] = lq.data ?? [];
  const goals: any[] = gq.data ?? [];
  const pendingLogs = logs.filter((l) => l.pending_push);
  const pendingGoals = goals.filter((g) => g.pending_push || g.deleted);

  // ---- پیدا کردن یا ساختن تب ماه ----
  let tabs = await listTabs(c, sheetId);
  let tab = tabs.find((x) => t(x.title) === tabTitle);
  if (!tab) {
    const now = fromISO(todayISO());
    const isCurrent = now.jy === jy && now.jm === jm;
    if (!isCurrent && !pendingLogs.length && !pendingGoals.length) return { status: "no_tab" };
    const template = tabs.filter((x) => t(x.title).startsWith(`${prefix} - `)).sort((a, b) => b.index - a.index)[0];
    if (!template) return { status: "no_template", message: `هیچ تبی با الگوی «${prefix} - ماه» پیدا نشد.` };
    await duplicateTab(c, sheetId, template, tabTitle);
    tabs = await listTabs(c, sheetId);
    tab = tabs.find((x) => t(x.title) === tabTitle)!;
    const q = qt(tabTitle);
    const blank = (r: number, n: number, v: any) => Array.from({ length: n }, () => Array.from({ length: 30 }, () => v));
    const wk: any[][] = [], mo: any[][] = [];
    for (let r = L.weeklyFirst; r <= L.weeklyLast; r++) wk.push(Array.from({ length: 30 }, (_, i) => (i % 7 === 0 ? false : "")));
    for (let r = L.monthlyFirst; r <= L.monthlyLast; r++) mo.push(Array.from({ length: 30 }, (_, i) => (i % 7 === 0 && i < 14 ? false : "")));
    await batchWrite(c, sheetId, [
      { range: `${q}!${L.yearCell}`, values: [[jy]] },
      { range: `${q}!D6`, values: [[MONTHS[jm - 1]]] },
      { range: `${q}!B${L.habitFirst}:E${L.habitLast}`, values: Array.from({ length: 15 }, () => ["", "", "", ""]) },
      { range: `${q}!G${L.habitFirst}:AJ${L.habitLast}`, values: blank(0, 15, false) },
      // «هدف روزانه» (ردیف ۳۴) در شیت دستی بود؛ اینجا خودکار = تعداد عادت‌های نام‌دار
      { range: `${q}!G${L.dailyTargetRow}:AJ${L.dailyTargetRow}`, values: [Array.from({ length: 30 }, () => `=COUNTA($B$${L.habitFirst}:$B$${L.habitLast})`)] },
      { range: `${q}!G${L.weeklyFirst}:AJ${L.weeklyLast}`, values: wk },
      { range: `${q}!G${L.monthlyFirst}:AJ${L.monthlyLast}`, values: mo },
    ]);
  }
  const q = qt(tab.title);

  // ---- خواندن وضعیت فعلی شیت ----
  const [nameR, checkR, weekR, monR] = await batchGet(c, sheetId, [
    `${q}!B${L.habitFirst}:E${L.habitLast}`,
    `${q}!G${L.habitFirst}:AJ${L.habitLast}`,
    `${q}!G${L.weeklyFirst}:AJ${L.weeklyLast}`,
    `${q}!G${L.monthlyFirst}:AJ${L.monthlyLast}`,
  ]);
  const nRows = L.habitLast - L.habitFirst + 1;
  const S = {
    names: Array.from({ length: nRows }, (_, i) => t(nameR[i]?.[0])),
    targets: Array.from({ length: nRows }, (_, i) => num(nameR[i]?.[3])),
    checks: Array.from({ length: nRows }, (_, i) => Array.from({ length: 30 }, (_, d) => checkR[i]?.[d] === true)),
    week: Array.from({ length: L.weeklyLast - L.weeklyFirst + 1 }, (_, i) => Array.from({ length: 30 }, (_, k) => weekR[i]?.[k] ?? "")),
    mon: Array.from({ length: L.monthlyLast - L.monthlyFirst + 1 }, (_, i) => Array.from({ length: 30 }, (_, k) => monR[i]?.[k] ?? "")),
  };
  const writes: { range: string; values: any[][] }[] = [];
  const put = (a1: string, v: any) => writes.push({ range: `${q}!${a1}`, values: [[v]] });
  let pushed = 0, pulled = 0;

  // ---- PUSH: عادت‌ها (نام/هدف) ----
  const rowOf = new Map<string, number>(); // habit.id → اندیس ردیف
  const keyOf = (h: any) => t(h.sheet_name ?? h.name);
  const { data: tg } = await db.from("habit_targets").select("*").eq("jy", jy).eq("jm", jm).in("habit_id", habits.map((h) => h.id).concat(["00000000-0000-0000-0000-000000000000"]));
  const targetOf = (h: any) => tg?.find((x: any) => x.habit_id === h.id)?.target ?? h.monthly_target ?? len;

  for (const h of habits) {
    let r = S.names.findIndex((n) => n && n === keyOf(h));
    if (r < 0 && h.archived) continue;
    if (r < 0) {
      r = S.names.findIndex((n) => !n);
      if (r < 0) continue; // ۱۵ ردیف پر است
      S.names[r] = t(h.name); S.targets[r] = targetOf(h);
      put(`B${L.habitFirst + r}`, h.name); put(`E${L.habitFirst + r}`, targetOf(h)); pushed++;
    } else if (S.names[r] !== t(h.name)) {
      S.names[r] = t(h.name); put(`B${L.habitFirst + r}`, h.name); pushed++;
    }
    rowOf.set(h.id, r);
  }

  // ---- PUSH: تیک‌های روزانه ----
  for (const l of pendingLogs) {
    const r = rowOf.get(l.habit_id);
    const d = fromISO(l.day).jd;
    if (r === undefined || d > 30) continue;
    S.checks[r][d - 1] = !!l.done;
    put(`${colName(L.dayCol0 + d - 1)}${L.habitFirst + r}`, !!l.done); pushed++;
  }

  // ---- PUSH: اهداف هفتگی/ماهانه ----
  const block = (scope: string) => (scope === "week" ? { grid: S.week, first: L.weeklyFirst } : { grid: S.mon, first: L.monthlyFirst });
  const goalsDone: string[] = [], goalsDelete: string[] = [];
  for (const g of pendingGoals) {
    const { grid, first } = block(g.scope);
    const off = (g.slot - 1) * 7;
    let r = grid.findIndex((row) => t(row[off + 1]) === t(g.title));
    if (g.deleted) {
      if (r >= 0) { grid[r][off] = false; grid[r][off + 1] = ""; put(`${colName(L.dayCol0 + off)}${first + r}`, false); put(`${colName(L.dayCol0 + off + 1)}${first + r}`, ""); }
      goalsDelete.push(g.id); continue;
    }
    if (r < 0) r = grid.findIndex((row) => !t(row[off + 1]));
    if (r < 0) continue;
    grid[r][off] = !!g.done; grid[r][off + 1] = g.title;
    put(`${colName(L.dayCol0 + off)}${first + r}`, !!g.done); put(`${colName(L.dayCol0 + off + 1)}${first + r}`, g.title);
    goalsDone.push(g.id); pushed++;
  }
  await batchWrite(c, sheetId, writes);
  if (pendingLogs.length) await db.from("habit_logs").update({ pending_push: false }).in("habit_id", pendingLogs.map((l) => l.habit_id)).in("day", pendingLogs.map((l) => l.day)).eq("pending_push", true);
  if (goalsDone.length) await db.from("goals").update({ pending_push: false }).in("id", goalsDone);
  if (goalsDelete.length) await db.from("goals").delete().in("id", goalsDelete);

  // ---- PULL: عادت‌های روزانه ----
  const logKey = (hid: string, day: string) => `${hid}|${day}`;
  const logMap = new Map(logs.map((l) => [logKey(l.habit_id, l.day), l]));
  const byKey = new Map(habits.map((h) => [keyOf(h), h]));
  byKey.forEach((h, k) => { if (t(h.name) !== k) byKey.set(t(h.name), h); });
  const isoOf = (d: number) => toIso(jy, jm, d);

  for (let r = 0; r < nRows; r++) {
    const name = S.names[r];
    if (!name) continue;
    let h = byKey.get(name);
    if (!h) {
      const { data: ins } = await db.from("habits").insert({ user_id: userId, name, sheet_name: name, monthly_target: S.targets[r], sort: habits.length + r }).select().single();
      if (!ins) continue;
      h = ins; habits.push(ins); byKey.set(name, ins); pulled++;
    } else if (h.sheet_name !== name && t(h.name) === name) {
      await db.from("habits").update({ sheet_name: name }).eq("id", h.id);
    }
    if (S.targets[r] !== null) await db.from("habit_targets").upsert({ habit_id: h.id, jy, jm, target: S.targets[r] });
    const inserts: any[] = [];
    for (let d = 1; d <= len; d++) {
      const day = isoOf(d), sv = S.checks[r][d - 1];
      const cur = logMap.get(logKey(h.id, day));
      if (!cur) { if (sv) inserts.push({ habit_id: h.id, user_id: userId, day, done: true }); }
      else if (!cur.pending_push && cur.done !== sv) { await db.from("habit_logs").update({ done: sv, updated_at: new Date().toISOString() }).eq("habit_id", h.id).eq("day", day); pulled++; }
    }
    if (inserts.length) { await db.from("habit_logs").upsert(inserts); pulled += inserts.length; }
  }

  // ---- PULL: اهداف هفتگی/ماهانه ----
  const gMap = new Map(goals.filter((g) => !g.deleted).map((g) => [`${g.scope}|${g.slot}|${t(g.title)}`, g]));
  const pullGoals = async (scope: "week" | "month", grid: any[][], slots: number) => {
    for (let s = 1; s <= slots; s++) {
      const off = (s - 1) * 7;
      for (const row of grid) {
        const title = t(row[off + 1]); if (!title) continue;
        const done = row[off] === true;
        const cur = gMap.get(`${scope}|${s}|${title}`);
        if (!cur) { await db.from("goals").insert({ user_id: userId, scope, jy, jm, slot: s, title, done }); pulled++; }
        else if (!cur.pending_push && cur.done !== done) { await db.from("goals").update({ done }).eq("id", cur.id); pulled++; }
      }
    }
  };
  await pullGoals("week", S.week, 5);
  await pullGoals("month", S.mon, 2);

  await db.from("user_settings").update({ last_sync_at: new Date().toISOString() }).eq("user_id", userId);
  return { status: "ok", pushed, pulled };
}

function toIso(jy: number, jm: number, jd: number) { return toISO({ jy, jm, jd }); }
