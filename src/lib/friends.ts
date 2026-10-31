"use client";
import { useCallback, useEffect, useState } from "react";
import { sb, sessionUser } from "./supabase-browser";
import { monthLength, monthRange } from "./jalali";
import { dueCount, isDue, type Recurrence } from "./recurrence";

export type FriendRow = {
  id: string; requester_id: string; requester_email: string; to_email: string;
  addressee_id: string | null; status: "pending" | "accepted" | "declined"; created_at: string;
};
export type Friend = { rowId: string; userId: string; email: string };
export type BoardData = {
  habits: { id: string; name: string; color: string; monthly_target: number | null; recurrence?: Recurrence | null; created_at?: string }[];
  logs: { habit_id: string; day: string }[];
  targets: { habit_id: string; target: number }[];
};

export const nameOf = (email: string) => email.split("@")[0];
export const AVATARS = ["#5B3DF5", "#26BCD0", "#AA3487", "#F5A028", "#2FA66A", "#E5484D"];
export const avatarColor = (s: string) => AVATARS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length];

export function friendlyError(msg?: string) {
  const m = msg || "";
  if (m.includes("self_request")) return "نمی‌توانی برای خودت درخواست بفرستی";
  if (m.includes("invalid_email")) return "ایمیل معتبر نیست";
  if (m.includes("reverse_exists")) return "این دوست قبلاً برای تو درخواست فرستاده؛ از بخش «درخواست‌ها» بپذیرش";
  if (m.includes("duplicate") || m.includes("23505")) return "قبلاً برای این ایمیل درخواست فرستاده‌ای";
  if (m.includes("not_friends")) return "دوستی تأیید نشده است";
  if (m.includes("friend_board") || m.includes("friendships")) return "امکان دوستان هنوز فعال نشده است؛ لطفاً با پشتیبانی تماس بگیرید";
  return /[\u0600-\u06FF]/.test(m) ? m : "مشکلی پیش آمد؛ دوباره تلاش کنید";
}

/* ---------- لیست دوستان و درخواست‌ها ---------- */
export function useFriends() {
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const db = sb();
      const u = await sessionUser();
      if (!u?.user) { setLoading(false); return; }
      setMe({ id: u.user.id, email: (u.user.email || "").toLowerCase() });
      const { data, error } = await db.from("friendships").select("*").order("created_at", { ascending: false });
      if (error) setError(friendlyError(error.message)); else setError(null);
      setRows((data ?? []) as FriendRow[]);
    } catch (e: any) { setError(friendlyError(e?.message)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mine = me?.id;
  const friends: Friend[] = rows.filter((r) => r.status === "accepted").flatMap((r) => {
    const iAmRequester = r.requester_id === mine;
    const userId = iAmRequester ? r.addressee_id : r.requester_id;
    return userId ? [{ rowId: r.id, userId, email: iAmRequester ? r.to_email : r.requester_email }] : [];
  });
  const incoming = rows.filter((r) => r.status === "pending" && r.requester_id !== mine);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === mine);

  async function send(email: string): Promise<{ ok: boolean; message: string }> {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return { ok: false, message: "ایمیل را درست وارد کن" };
    const { error } = await sb().from("friendships").insert({ to_email: clean });
    if (error) return { ok: false, message: friendlyError(error.message) };
    await load();
    return { ok: true, message: "درخواست ارسال شد. به محض اینکه با این ایمیل وارد شود و بپذیرد، دوست می‌شوید." };
  }
  async function accept(id: string) { const { error } = await sb().from("friendships").update({ status: "accepted" }).eq("id", id); if (error) setError(friendlyError(error.message)); await load(); }
  async function remove(id: string) { const { error } = await sb().from("friendships").delete().eq("id", id); if (error) setError(friendlyError(error.message)); await load(); }

  return { me, friends, incoming, outgoing, loading, error, send, accept, remove, reload: load };
}

/* ---------- جدول ماه یک دوست ---------- */
export async function fetchBoard(friendId: string, jy: number, jm: number): Promise<BoardData> {
  const { start, end } = monthRange(jy, jm);
  const { data, error } = await sb().rpc("friend_board", { friend: friendId, d_start: start, d_end: end, p_jy: jy, p_jm: jm });
  if (error) throw new Error(friendlyError(error.message));
  return data as BoardData;
}

export function makeBoard(b: BoardData | null, jy: number, jm: number) {
  const set = new Set((b?.logs ?? []).map((l) => `${l.habit_id}|${l.day}`));
  const tg = Object.fromEntries((b?.targets ?? []).map((t) => [t.habit_id, t.target]));
  const habits = b?.habits ?? [];
  const targetOf = (h: BoardData["habits"][number]) => (h.recurrence ? dueCount(h, jy, jm) : tg[h.id] ?? h.monthly_target ?? monthLength(jy, jm));
  const isDueOn = (h: BoardData["habits"][number], day: string) => isDue(h, day);
  const isDone = (hid: string, day: string) => set.has(`${hid}|${day}`);
  const countOf = (hid: string) => {
    const h = habits.find((x) => x.id === hid);
    return (b?.logs ?? []).filter((l) => l.habit_id === hid && (!h?.recurrence || isDue(h, l.day))).length;
  };
  /** عادت‌هایی که در یک روز نوبت دارند یا تیک خورده‌اند */
  const habitsOn = (day: string) => habits.filter((h) => isDue(h, day) || set.has(`${h.id}|${day}`));
  const done = habits.reduce((s, h) => s + countOf(h.id), 0);
  const target = habits.reduce((s, h) => s + targetOf(h), 0);
  return { habits, isDone, isDueOn, countOf, targetOf, habitsOn, done, target, pct: target ? done / target : 0 };
}

export function useFriendBoard(friendId: string | null, jy: number, jm: number) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!friendId) return;
    let alive = true;
    setLoading(true);
    fetchBoard(friendId, jy, jm).then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [friendId, jy, jm]);
  return { ...makeBoard(data, jy, jm), loading, error };
}
