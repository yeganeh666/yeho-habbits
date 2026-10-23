-- در Supabase > SQL Editor اجرا کنید.
create extension if not exists pgcrypto;

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  sheet_name text,                 -- نامی که آخرین بار در شیت نوشته شده (برای تشخیص تغییر نام)
  monthly_target int,              -- هدف پیش‌فرض ماهانه (ستون «هدف» شیت)
  color text not null default '#5B3DF5',
  sort int not null default 0,
  archived boolean not null default false,
  reminder_time time,              -- یادآور روزانه در تقویم گوگل
  reminder_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists habit_targets (
  habit_id uuid references habits(id) on delete cascade,
  jy int not null, jm int not null, target int not null,
  primary key (habit_id, jy, jm)
);

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

-- عادت‌های هفتگی (scope=week، slot=۱..۵) و ماهانه (scope=month، slot=۱..۲)
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('week','month')),
  jy int not null, jm int not null, slot int not null default 1,
  title text not null,
  done boolean not null default false,
  pending_push boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_month on goals(user_id, jy, jm);

-- تودولیست روزانه
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  title text not null,
  done boolean not null default false,
  remind_time time,
  event_id text,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_day on todos(user_id, day);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sheet_id text,
  tab_prefix text not null default 'حسین',
  google_email text,
  last_sync_at timestamptz
);

-- توکن‌های گوگل: RLS روشن و بدون policy => فقط سرور (service role) دسترسی دارد
create table if not exists google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table habits enable row level security;
alter table habit_targets enable row level security;
alter table habit_logs enable row level security;
alter table goals enable row level security;
alter table todos enable row level security;
alter table user_settings enable row level security;
alter table google_tokens enable row level security;

create policy "own habits" on habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own targets" on habit_targets for all
  using (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));
create policy "own logs" on habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals" on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own todos" on todos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
