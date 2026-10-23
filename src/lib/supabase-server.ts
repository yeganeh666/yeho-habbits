import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function isConfigured(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (!url.startsWith("http")) return false;
  if (url.includes("xxxx") || url.includes("placeholder") || url.includes("example") || url.includes("your-")) return false;
  if (key === "eyJ..." || key.includes("...") || key.length < 20) return false;
  return true;
}

const isClientConfigured = () =>
  isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const isAdminConfigured = () =>
  isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// In-memory store for server-side mock operations
const memoryStore = new Map<string, any[]>();

class MockServerQueryBuilder {
  private table: string;
  private filters: ((item: any) => boolean)[] = [];
  private isSingle = false;
  private isMaybeSingle = false;
  private mutationResult: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) {
    return this;
  }

  order(_field: string, _opts?: any) {
    return this;
  }

  eq(field: string, val: any) {
    this.filters.push((item) => item[field] === val);
    return this;
  }

  gte(field: string, val: any) {
    this.filters.push((item) => (item[field] ?? "") >= val);
    return this;
  }

  lte(field: string, val: any) {
    this.filters.push((item) => (item[field] ?? "") <= val);
    return this;
  }

  in(field: string, vals: any[]) {
    this.filters.push((item) => vals.includes(item[field]));
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(values: any | any[]) {
    const items = Array.isArray(values) ? values : [values];
    const list = memoryStore.get(this.table) || [];
    const added: any[] = [];
    for (const v of items) {
      const item = {
        id: v.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        created_at: v.created_at || new Date().toISOString(),
        ...v,
      };
      list.push(item);
      added.push(item);
    }
    memoryStore.set(this.table, list);
    this.mutationResult = Array.isArray(values) ? added : added[0];
    return this;
  }

  update(patch: any) {
    const list = memoryStore.get(this.table) || [];
    const updated = list.map((item) => {
      const match = this.filters.every((fn) => fn(item));
      return match ? { ...item, ...patch } : item;
    });
    memoryStore.set(this.table, updated);
    this.mutationResult = { count: 1 };
    return this;
  }

  upsert(values: any | any[], _opts?: any) {
    return this.insert(values);
  }

  delete() {
    const list = memoryStore.get(this.table) || [];
    const remaining = list.filter((item) => !this.filters.every((fn) => fn(item)));
    memoryStore.set(this.table, remaining);
    this.mutationResult = { count: list.length - remaining.length };
    return this;
  }

  private execute() {
    if (this.mutationResult !== null) {
      return { data: this.mutationResult, error: null };
    }
    let list = memoryStore.get(this.table) || [];
    for (const fn of this.filters) {
      list = list.filter(fn);
    }
    if (this.isSingle) {
      return { data: list[0] ?? null, error: list.length ? null : { message: "Not found" } };
    }
    if (this.isMaybeSingle) {
      return { data: list[0] ?? null, error: null };
    }
    return { data: list, error: null };
  }

  then(onFulfilled: (res: any) => any, onRejected?: (err: any) => any) {
    try {
      const res = this.execute();
      return Promise.resolve(onFulfilled(res));
    } catch (err) {
      if (onRejected) return Promise.resolve(onRejected(err));
      throw err;
    }
  }
}

function createMockServerClient(): any {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "mock-user-id", email: "کاربر محلی" } },
        error: null,
      }),
    },
    from: (table: string) => new MockServerQueryBuilder(table),
  };
}

export function serverClient() {
  if (!isClientConfigured()) {
    return createMockServerClient();
  }
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
  if (!isAdminConfigured()) {
    return createMockServerClient();
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function currentUser() {
  if (!isClientConfigured()) {
    return { id: "mock-user-id", email: "کاربر محلی" } as any;
  }
  try {
    const { data } = await serverClient().auth.getUser();
    return data.user;
  } catch {
    return { id: "mock-user-id", email: "کاربر محلی" } as any;
  }
}
