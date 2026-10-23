/**
 * Supabase configuration strictly read from project environment variables
 */

export function isValidSupabaseUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) return false;
  if (clean.includes("xxxx") || clean.includes("placeholder") || clean.includes("example") || clean.includes("your-project")) {
    return false;
  }
  return clean.length >= 15;
}

export function isValidSupabaseKey(key?: string | null): boolean {
  if (!key) return false;
  const clean = key.trim();
  if (clean === "eyJ..." || clean.includes("...") || clean.length < 25) {
    return false;
  }
  return true;
}

export function getClientSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean } {
  const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const isConfigured = isValidSupabaseUrl(envUrl) && isValidSupabaseKey(envKey);

  return { url: envUrl, anonKey: envKey, isConfigured };
}
