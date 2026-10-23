import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-server";
import { oauthClient } from "@/lib/google";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, process.env.APP_URL));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [cookieState, userId] = (req.cookies.get("g_state")?.value ?? "").split(".");
  if (!code || !state || state !== cookieState || !userId) return back("google=error");
  try {
    const c = oauthClient();
    const { tokens } = await c.getToken(code);
    if (!tokens.refresh_token) return back("google=norefresh");
    c.setCredentials(tokens);
    const info = tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64").toString()) : {};
    const db = adminClient();
    await db.from("google_tokens").upsert({ user_id: userId, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() });
    await db.from("user_settings").upsert({ user_id: userId, google_email: info.email ?? null }, { onConflict: "user_id" });
    const res = back("google=ok");
    res.cookies.delete("g_state");
    return res;
  } catch {
    return back("google=error");
  }
}
