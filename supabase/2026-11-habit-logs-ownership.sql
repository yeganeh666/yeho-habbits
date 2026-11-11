-- ==============================================================
-- Security fix: habit_logs must belong to a habit the user owns.
-- Run once in Supabase > SQL Editor on databases created before Nov 2026.
-- Safe to run more than once. (schema.sql already contains this policy.)
--
-- Before: the policy only checked habit_logs.user_id = auth.uid(), so a user
-- who knew someone else's habit id (friends receive them via friend_board)
-- could insert a log row for that habit and day, blocking the owner's own
-- tick and changing what the owner's friends see.
-- ==============================================================

-- 1. Tighten the policy
drop policy if exists "own logs" on habit_logs;
create policy "own logs" on habit_logs for all
  using (user_id = auth.uid() and exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));

-- 2. Check for rows that were written into someone else's habit
--    (each row here is invalid: its user_id is not the habit's owner)
select l.habit_id, l.day, l.user_id as written_by, h.user_id as habit_owner
from habit_logs l join habits h on h.id = l.habit_id
where l.user_id <> h.user_id;

-- 3. If step 2 returned rows, remove them by uncommenting and running:
-- delete from habit_logs l using habits h
-- where h.id = l.habit_id and l.user_id <> h.user_id;
