import { createBrowserClient } from "@supabase/ssr";

function isConfigured(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (!url.startsWith("http")) return false;
  if (url.includes("xxxx") || url.includes("placeholder") || url.includes("example") || url.includes("your-")) return false;
  if (key === "eyJ..." || key.includes("...") || key.length < 20) return false;
  return true;
}

// Default initial sample data if none exists in localStorage
const DEFAULT_HABITS = [
  { id: "h1", name: "مطالعه (۲۰ دقیقه)", monthly_target: 25, color: "#5B3DF5", sort: 0, archived: false, created_at: new Date().toISOString() },
  { id: "h2", name: "ورزش روزانه", monthly_target: 20, color: "#26BCD0", sort: 1, archived: false, created_at: new Date().toISOString() },
  { id: "h3", name: "نوشیدن ۸ لیوان آب", monthly_target: 30, color: "#F5A028", sort: 2, archived: false, created_at: new Date().toISOString() },
];

function getStore(table: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`habitly_mock_${table}`);
    if (raw) return JSON.parse(raw);
    if (table === "habits") {
      localStorage.setItem(`habitly_mock_habits`, JSON.stringify(DEFAULT_HABITS));
      return [...DEFAULT_HABITS];
    }
    return [];
  } catch {
    return [];
  }
}

function setStore(table: string, data: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`habitly_mock_${table}`, JSON.stringify(data));
  } catch {}
}

class MockQueryBuilder {
  private table: string;
  private filters: ((item: any) => boolean)[] = [];
  private orderField?: string;
  private orderAsc: boolean = true;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private mutationResult: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) {
    return this;
  }

  order(field: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending !== false;
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
    const store = getStore(this.table);
    const added: any[] = [];
    for (const v of items) {
      const item = {
        id: v.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        created_at: v.created_at || new Date().toISOString(),
        ...v,
      };
      store.push(item);
      added.push(item);
    }
    setStore(this.table, store);
    this.mutationResult = Array.isArray(values) ? added : added[0];
    return this;
  }

  update(patch: any) {
    const store = getStore(this.table);
    let updatedCount = 0;
    const newStore = store.map((item) => {
      const match = this.filters.every((fn) => fn(item));
      if (match) {
        updatedCount++;
        return { ...item, ...patch };
      }
      return item;
    });
    setStore(this.table, newStore);
    this.mutationResult = { count: updatedCount };
    return this;
  }

  upsert(values: any | any[], _opts?: any) {
    const items = Array.isArray(values) ? values : [values];
    const store = getStore(this.table);
    const added: any[] = [];

    for (const v of items) {
      let idx = -1;
      if (this.table === "habit_logs") {
        idx = store.findIndex((x) => x.habit_id === v.habit_id && x.day === v.day);
      } else if (this.table === "habit_targets") {
        idx = store.findIndex((x) => x.habit_id === v.habit_id && x.jy === v.jy && x.jm === v.jm);
      } else if (this.table === "user_settings") {
        idx = store.findIndex((x) => x.user_id === v.user_id);
      } else if (v.id) {
        idx = store.findIndex((x) => x.id === v.id);
      }

      const record = {
        id: v.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        created_at: v.created_at || new Date().toISOString(),
        ...v,
      };

      if (idx >= 0) {
        store[idx] = { ...store[idx], ...record };
        added.push(store[idx]);
      } else {
        store.push(record);
        added.push(record);
      }
    }
    setStore(this.table, store);
    this.mutationResult = Array.isArray(values) ? added : added[0];
    return this;
  }

  delete() {
    const store = getStore(this.table);
    const remaining = store.filter((item) => !this.filters.every((fn) => fn(item)));
    setStore(this.table, remaining);
    this.mutationResult = { count: store.length - remaining.length };
    return this;
  }

  private execute() {
    if (this.mutationResult !== null) {
      return { data: this.mutationResult, error: null };
    }
    let list = getStore(this.table);
    for (const fn of this.filters) {
      list = list.filter(fn);
    }
    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAsc;
      list = [...list].sort((a, b) => {
        const valA = a[field] ?? "";
        const valB = b[field] ?? "";
        return asc ? (valA > valB ? 1 : valA < valB ? -1 : 0) : (valA < valB ? 1 : valA > valB ? -1 : 0);
      });
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

function createMockBrowserClient(): any {
  return {
    auth: {
      getUser: async () => {
        const userEmail = typeof window !== "undefined" ? localStorage.getItem("habitly_mock_user_email") : null;
        return {
          data: {
            user: {
              id: "mock-user-id",
              email: userEmail || "کاربر محلی (آفلاین)",
            },
          },
          error: null,
        };
      },
      signInWithPassword: async ({ email }: { email: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("habitly_mock_user_email", email);
        }
        return { data: { session: { user: { id: "mock-user-id", email } } }, error: null };
      },
      signUp: async ({ email }: { email: string }) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("habitly_mock_user_email", email);
        }
        return { data: { session: { user: { id: "mock-user-id", email } } }, error: null };
      },
      signOut: async () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("habitly_mock_user_email");
        }
        return { error: null };
      },
    },
    from: (table: string) => new MockQueryBuilder(table),
  };
}

let client: ReturnType<typeof createBrowserClient> | any = null;

export function sb() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (isConfigured(url, anon)) {
      client = createBrowserClient(url!, anon!);
    } else {
      client = createMockBrowserClient();
    }
  }
  return client;
}
