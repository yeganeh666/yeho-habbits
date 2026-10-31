-- ==============================================================
-- اجرای این اسکریپت در Supabase: داشبورد پروژه > بخش SQL Editor > New query
-- این کوئری تمام جدول‌ها، نمایه‌ها (Indexes) و سیاست‌های امنیتی (RLS) را ایجاد می‌کند
-- ==============================================================

-- ۱. فعال‌سازی افزونه رمزنگاری و ساخت شناسه‌های تصادفی (UUID)
create extension if not exists pgcrypto;

-- ۲. جدول عادت‌های روزانه (Habits)
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  sheet_name text,
  monthly_target int,
  color text not null default '#5B3DF5',
  sort int not null default 0,
  archived boolean not null default false,
  reminder_time time,
  reminder_event_id text,
  created_at timestamptz not null default now()
);

-- ۳. جدول اهداف عددی هر ماه برای هر عادت (Habit Targets)
create table if not exists habit_targets (
  habit_id uuid references habits(id) on delete cascade,
  jy int not null,
  jm int not null,
  target int not null,
  primary key (habit_id, jy, jm)
);

-- ۴. جدول تیک‌های روزانه عادت‌ها (Habit Logs)
create table if not exists habit_logs (
  habit_id uuid references habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  done boolean not null default false,
  pending_push boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists habit_logs_user_day on habit_logs(user_id, day);

-- ۵. جدول هدف‌های هفتگی و ماهانه (Goals)
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('week','month')),
  jy int not null,
  jm int not null,
  slot int not null default 1,
  title text not null,
  done boolean not null default false,
  pending_push boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_month on goals(user_id, jy, jm);

-- ۶. جدول کارهای روزانه، یادآورها و جلسات تقویم گوگل (Todos)
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  title text not null,
  done boolean not null default false,
  remind_time time,
  remind_date date,
  event_type text default 'reminder',
  duration_minutes int default 30,
  event_id text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_day on todos(user_id, day);

-- اضافه کردن ستون‌های تکمیلی به جدول todos در صورت وجود قبلی
alter table todos add column if not exists remind_date date;
alter table todos add column if not exists event_type text default 'reminder';
alter table todos add column if not exists duration_minutes int default 30;
alter table todos add column if not exists event_id text;
alter table todos add column if not exists sort int not null default 0;

-- ۷. جدول تنظیمات کاربر و اتصال به تقویم گوگل (User Settings)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  script_url text,
  calendar_connected boolean default false,
  google_email text,
  last_sync_at timestamptz
);

alter table user_settings add column if not exists script_url text;
alter table user_settings add column if not exists calendar_connected boolean default false;
alter table user_settings add column if not exists google_email text;
alter table user_settings add column if not exists last_sync_at timestamptz;

-- ۸. جدول توکن‌های اتصال گوگل
create table if not exists google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- ==============================================================
-- ۹. تنظیم قوانین امنیت در سطح سطر (Row Level Security - RLS)
-- هر کاربر تنها به اطلاعات خودش دسترسی خواهد داشت
-- ==============================================================

alter table habits enable row level security;
alter table habit_targets enable row level security;
alter table habit_logs enable row level security;
alter table goals enable row level security;
alter table todos enable row level security;
alter table user_settings enable row level security;
alter table google_tokens enable row level security;

-- سیاست دسترسی جدول عادت‌ها (habits)
drop policy if exists "own habits" on habits;
create policy "own habits" on habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- سیاست دسترسی اهداف ماهانه (habit_targets)
drop policy if exists "own targets" on habit_targets;
create policy "own targets" on habit_targets for all
  using (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));

-- سیاست دسترسی گزارش تیک‌ها (habit_logs)
drop policy if exists "own logs" on habit_logs;
create policy "own logs" on habit_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- سیاست دسترسی اهداف (goals)
drop policy if exists "own goals" on goals;
create policy "own goals" on goals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- سیاست دسترسی کارهای روزانه و جلسات (todos)
drop policy if exists "own todos" on todos;
create policy "own todos" on todos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- سیاست دسترسی تنظیمات کاربر (user_settings)
drop policy if exists "own settings" on user_settings;
create policy "own settings" on user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
