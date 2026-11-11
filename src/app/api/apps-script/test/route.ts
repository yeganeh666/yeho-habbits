import { NextResponse } from "next/server";
import { callAppsScript, isAppsScriptUrl } from "@/lib/apps-script";
import { currentUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const { scriptUrl } = await req.json();
    if (!scriptUrl || typeof scriptUrl !== "string" || !scriptUrl.trim()) {
      return NextResponse.json({ ok: false, error: "آدرس اسکریپت تقویم وارد نشده است." }, { status: 400 });
    }
    if (!isAppsScriptUrl(scriptUrl)) {
      return NextResponse.json({ ok: false, error: "آدرس اسکریپت معتبر نیست؛ باید با https://script.google.com/macros/s/ شروع شود و به /exec ختم شود." }, { status: 400 });
    }
    const res = await callAppsScript(scriptUrl, "test");
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
