import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isValidSupabaseKey, isValidSupabaseUrl } from "./supabase-config";

export function getServerSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || anonKey;

  const isConfigured = isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey);

  return { url, anonKey, serviceKey, isConfigured };
}

export function serverClient() {
  const { url, anonKey, isConfigured } = getServerSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  const store = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

export function adminClient() {
  const { url, serviceKey, isConfigured } = getServerSupabaseConfig();

  if (!isConfigured || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function currentUser() {
  try {
    const supabase = serverClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}
