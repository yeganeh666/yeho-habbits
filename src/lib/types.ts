export type Habit = {
  id: string; name: string; sheet_name: string | null; monthly_target: number | null;
  color: string; sort: number; archived: boolean; reminder_time: string | null; reminder_event_id: string | null;
};
export type Log = { habit_id: string; day: string; done: boolean; pending_push: boolean };
export type Goal = {
  id: string; scope: "week" | "month"; jy: number; jm: number; slot: number;
  title: string; done: boolean; pending_push: boolean; deleted: boolean;
};
export type Todo = { id: string; day: string; title: string; done: boolean; remind_time: string | null; event_id: string | null };
export type Settings = { user_id: string; sheet_id: string | null; tab_prefix: string; google_email: string | null; last_sync_at: string | null };
