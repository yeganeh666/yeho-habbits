import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { currentUser } from "@/lib/supabase-server";
import { SCOPES, oauthClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin || process.env.APP_URL || "http://localhost:3000";
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/settings?google=nokeys", origin));
  }

  try {
    const state = randomBytes(16).toString("hex");
    const url = oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
      include_granted_scopes: true,
    });
    const res = NextResponse.redirect(url);
    res.cookies.set("g_state", `${state}.${user.id}`, {
      httpOnly: true,
      secure: origin.startsWith("https"),
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.redirect(new URL("/settings?google=error", origin));
  }
}
