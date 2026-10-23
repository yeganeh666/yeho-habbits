"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";
import { getClientSupabaseCredentials } from "@/lib/supabase-config";
import { BottomNav, Toaster } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const creds = getClientSupabaseCredentials();
    if (!creds.isConfigured) {
      r.replace("/login");
      return;
    }

    sb()
      .auth.getUser()
      .then(({ data }) => {
        if (!data?.user) {
          r.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        r.replace("/login");
      });
  }, [r]);

  if (checking) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-3 border-brand border-t-transparent" />
          <p className="text-xs font-bold text-mute">در حال اعتبارسنجی حساب کاربری در Supabase…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+12px)] safe-b">
      {children}
      <BottomNav />
      <Toaster />
    </div>
  );
}
