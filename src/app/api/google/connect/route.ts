import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { currentUser } from "@/lib/supabase-server";
import { SCOPES, oauthClient } from "@/lib/google";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.APP_URL));
  const state = randomBytes(16).toString("hex");
  const url = oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state, include_granted_scopes: true });
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", `${state}.${user.id}`, { httpOnly: true, secure: process.env.APP_URL?.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
