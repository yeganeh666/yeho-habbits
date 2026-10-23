import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase-server";
import { syncMonth } from "@/lib/sync";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { jy, jm } = await req.json();
  try {
    return NextResponse.json(await syncMonth(user.id, Number(jy), Number(jm)));
  } catch (e: any) {
    return NextResponse.json({ status: "error", message: String(e?.message ?? e).slice(0, 400) }, { status: 500 });
  }
}
