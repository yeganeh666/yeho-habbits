import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isConfigured(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (!url.startsWith("http")) return false;
  if (url.includes("xxxx") || url.includes("placeholder") || url.includes("example") || url.includes("your-")) return false;
  if (key === "eyJ..." || key.includes("...") || key.length < 20) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isConfigured(supabaseUrl, supabaseKey)) {
    // Supabase credentials are placeholder or unconfigured — allow full mock access
    return res;
  }

  try {
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    const isLogin = req.nextUrl.pathname.startsWith("/login");
    if (!data?.user && !isLogin) return NextResponse.redirect(new URL("/login", req.url));
    if (data?.user && isLogin) return NextResponse.redirect(new URL("/", req.url));
  } catch {
    // If Supabase check fails, allow pass-through
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|favicon.ico|api/google/callback).*)"],
};
