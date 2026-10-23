import { OAuth2Client } from "google-auth-library";
import { adminClient } from "./supabase-server";

export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
  "openid", "email",
];
export const oauthClient = () =>
  new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.APP_URL}/api/google/callback`);

export async function authedClient(userId: string) {
  const { data } = await adminClient().from("google_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const c = oauthClient();
  c.setCredentials({ refresh_token: data.refresh_token });
  return c;
}

export async function gfetch(c: OAuth2Client, url: string, init: RequestInit = {}) {
  const { token } = await c.getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
