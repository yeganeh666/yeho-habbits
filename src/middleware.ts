import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isValidSupabaseKey, isValidSupabaseUrl } from "@/lib/supabase-config";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  const isLogin = req.nextUrl.pathname.startsWith("/login");
  const isApi = req.nextUrl.pathname.startsWith("/api");

  // If Supabase credentials are not configured in project env, stay on /login
  if (!isValidSupabaseUrl(supabaseUrl) || !isValidSupabaseKey(supabaseKey)) {
    if (!isLogin && !isApi) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });

    // getClaims توکن را (در صورت امکان) به‌صورت محلی اعتبارسنجی می‌کند و برخلاف getUser
    // برای هر ناوبری یک درخواست شبکه به سرور احراز هویت نمی‌زند؛ توکن منقضی را هم تازه می‌کند.
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims ?? null;

    // Unauthenticated user attempting to access private app pages
    if (!user && !isLogin && !isApi) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Authenticated user trying to access /login
    if (user && isLogin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  } catch {
    if (!isLogin && !isApi) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|favicon.ico|api/google/callback).*)",
  ],
};
