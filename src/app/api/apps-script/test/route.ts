import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { scriptUrl } = await req.json();
    if (!scriptUrl || !scriptUrl.trim()) {
      return NextResponse.json({ ok: false, error: "آدرس اسکریپت تقویم وارد نشده است." }, { status: 400 });
    }
    const res = await callAppsScript(scriptUrl, "test");
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
