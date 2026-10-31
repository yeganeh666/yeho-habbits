import { createBrowserClient } from "@supabase/ssr";
import { getClientSupabaseCredentials } from "./supabase-config";

let client: ReturnType<typeof createBrowserClient> | null = null;
let lastUrl = "";
let lastKey = "";

export function sb(): ReturnType<typeof createBrowserClient> {
  const { url, anonKey, isConfigured } = getClientSupabaseCredentials();

  if (isConfigured && (client === null || lastUrl !== url || lastKey !== anonKey)) {
    client = createBrowserClient(url, anonKey);
    lastUrl = url;
    lastKey = anonKey;
    return client;
  }

  if (client) {
    return client;
  }

  // Fallback client for unconfigured state — no mock data!
  const unconfiguredError = { message: "پایگاه داده Supabase هنوز تنظیم نشده است. لطفاً ابتدا به حساب Supabase خود متصل شوید." };
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: unconfiguredError }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { session: null, user: null }, error: unconfiguredError }),
      signUp: async () => ({ data: { session: null, user: null }, error: unconfiguredError }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (_table: string) => {
      const emptyBuilder: any = {
        select: () => emptyBuilder,
        order: () => emptyBuilder,
        eq: () => emptyBuilder,
        gte: () => emptyBuilder,
        lte: () => emptyBuilder,
        in: () => emptyBuilder,
        single: () => emptyBuilder,
        maybeSingle: () => emptyBuilder,
        insert: () => emptyBuilder,
        update: () => emptyBuilder,
        upsert: () => emptyBuilder,
        delete: () => emptyBuilder,
        then: (onFulfilled: any) => Promise.resolve(onFulfilled({ data: null, error: unconfiguredError })),
      };
      return emptyBuilder;
    },
  } as any;
}

/**
 * کاربر فعلی از نشست ذخیره‌شده در مرورگر (بدون رفت‌وبرگشت شبکه).
 * auth.getUser() برای هر بار فراخوانی یک درخواست به سرور احراز هویت می‌زند و
 * باعث کندی هر صفحه می‌شد؛ امنیت داده‌ها هم‌چنان با RLS در پایگاه داده تضمین است.
 */
export async function sessionUser() {
  const { data } = await sb().auth.getSession();
  return { user: data.session?.user ?? null };
}

/**
 * Migration helper: if user previously had mock items in localStorage from offline mode,
 * migrate them into their real Supabase account under user.id.
 */
export async function migrateLocalDataToSupabase(userId: string): Promise<{ migratedHabits: number; migratedTodos: number }> {
  if (typeof window === "undefined" || !userId) return { migratedHabits: 0, migratedTodos: 0 };
  const db = sb();
  let migratedHabits = 0;
  let migratedTodos = 0;

  try {
    // 1. Habits
    const rawHabits = localStorage.getItem("habitly_mock_habits");
    if (rawHabits) {
      const items = JSON.parse(rawHabits);
      if (Array.isArray(items) && items.length > 0) {
        for (const h of items) {
          const { error } = await db.from("habits").insert({
            user_id: userId,
            name: h.name,
            monthly_target: h.monthly_target || null,
            color: h.color || "#5B3DF5",
            sort: h.sort || 0,
            archived: Boolean(h.archived),
          });
          if (!error) migratedHabits++;
        }
      }
      localStorage.removeItem("habitly_mock_habits");
    }

    // 2. Todos
    const rawTodos = localStorage.getItem("habitly_mock_todos");
    if (rawTodos) {
      const items = JSON.parse(rawTodos);
      if (Array.isArray(items) && items.length > 0) {
        for (const t of items) {
          const { error } = await db.from("todos").insert({
            user_id: userId,
            day: t.day,
            title: t.title,
            done: Boolean(t.done),
            remind_time: t.remind_time || null,
            remind_date: t.remind_date || null,
            event_type: t.event_type || null,
            duration_minutes: t.duration_minutes || null,
          });
          if (!error) migratedTodos++;
        }
      }
      localStorage.removeItem("habitly_mock_todos");
    }

    // 3. Clean up other mock keys
    localStorage.removeItem("habitly_mock_goals");
    localStorage.removeItem("habitly_mock_habit_logs");
    localStorage.removeItem("habitly_mock_habit_targets");
    localStorage.removeItem("habitly_mock_user_settings");
    localStorage.removeItem("habitly_mock_user_email");
  } catch (err) {
    console.error("Migration error:", err);
  }

  return { migratedHabits, migratedTodos };
}
