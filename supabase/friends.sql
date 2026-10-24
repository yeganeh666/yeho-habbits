-- ==============================================================
-- قابلیت دوستان و رقابت — اجرا در Supabase > SQL Editor (بعد از schema.sql)
-- چند بار اجرا کردنش مشکلی ایجاد نمی‌کند.
--
-- طرز کار: کاربر ایمیل دوستش را وارد می‌کند و درخواست می‌فرستد (بدون اینکه
-- اپ لو بدهد آن ایمیل ثبت‌نام کرده یا نه). دوست با همان ایمیل وارد می‌شود،
-- درخواست را می‌بیند و می‌پذیرد. فقط بعد از پذیرش، جدول عادت‌ها قابل مشاهده است.
-- ==============================================================

-- عادت خصوصی: برای دوستان نمایش داده نمی‌شود
alter table habits add column if not exists is_private boolean not null default false;

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requester_email text not null default '',
  to_email text not null,
  addressee_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
create unique index if not exists friendships_pair on friendships (requester_id, lower(to_email));
create index if not exists friendships_to on friendships (lower(to_email));
create index if not exists friendships_addressee on friendships (addressee_id);

alter table friendships enable row level security;

create or replace function public.jwt_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

drop policy if exists "friendship read" on friendships;
create policy "friendship read" on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid() or lower(to_email) = public.jwt_email());

drop policy if exists "friendship send" on friendships;
create policy "friendship send" on friendships for insert
  with check (requester_id = auth.uid());

drop policy if exists "friendship answer" on friendships;
create policy "friendship answer" on friendships for update
  using (lower(to_email) = public.jwt_email())
  with check (lower(to_email) = public.jwt_email());

drop policy if exists "friendship delete" on friendships;
create policy "friendship delete" on friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid() or lower(to_email) = public.jwt_email());

-- هنگام ارسال: ایمیل فرستنده از توکن گرفته می‌شود (جعل‌شدنی نیست) و وضعیت همیشه pending است
create or replace function public.friendships_before_insert() returns trigger
language plpgsql as $$
begin
  new.requester_id := auth.uid();
  new.requester_email := public.jwt_email();
  new.to_email := lower(trim(new.to_email));
  new.status := 'pending';
  new.addressee_id := null;
  if new.to_email = '' or position('@' in new.to_email) = 0 then raise exception 'invalid_email'; end if;
  if new.to_email = new.requester_email then raise exception 'self_request'; end if;
  if exists (select 1 from friendships f where lower(f.to_email) = new.requester_email and f.requester_email = new.to_email) then
    raise exception 'reverse_exists';
  end if;
  return new;
end $$;
drop trigger if exists friendships_bi on friendships;
create trigger friendships_bi before insert on friendships for each row execute function public.friendships_before_insert();

-- هنگام پاسخ: فقط گیرنده می‌تواند وضعیت را به accepted / declined ببرد؛ بقیهٔ ستون‌ها ثابت می‌مانند
create or replace function public.friendships_before_update() returns trigger
language plpgsql as $$
begin
  if lower(old.to_email) <> public.jwt_email() then raise exception 'not_allowed'; end if;
  new.requester_id := old.requester_id;
  new.requester_email := old.requester_email;
  new.to_email := old.to_email;
  new.created_at := old.created_at;
  new.addressee_id := auth.uid();
  if new.status not in ('accepted','declined') then new.status := old.status; end if;
  return new;
end $$;
drop trigger if exists friendships_bu on friendships;
create trigger friendships_bu before update on friendships for each row execute function public.friendships_before_update();

-- خواندن جدول عادت‌های یک دوست (فقط اگر دوستی تأییدشده باشد و فقط عادت‌های غیرخصوصی)
create or replace function public.friend_board(friend uuid, d_start date, d_end date, p_jy int, p_jm int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = friend)
        or (f.addressee_id = auth.uid() and f.requester_id = friend))
  ) into ok;
  if not ok then raise exception 'not_friends'; end if;

  return jsonb_build_object(
    'habits', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'color', h.color, 'monthly_target', h.monthly_target) order by h.sort, h.created_at)
      from habits h where h.user_id = friend and not h.archived and not h.is_private), '[]'::jsonb),
    'logs', coalesce((
      select jsonb_agg(jsonb_build_object('habit_id', l.habit_id, 'day', l.day))
      from habit_logs l join habits h on h.id = l.habit_id
      where h.user_id = friend and not h.archived and not h.is_private and l.done and l.day between d_start and d_end), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('habit_id', t.habit_id, 'target', t.target))
      from habit_targets t join habits h on h.id = t.habit_id
      where h.user_id = friend and not h.archived and not h.is_private and t.jy = p_jy and t.jm = p_jm), '[]'::jsonb)
  );
end $$;
revoke all on function public.friend_board(uuid, date, date, int, int) from public, anon;
grant execute on function public.friend_board(uuid, date, date, int, int) to authenticated;
