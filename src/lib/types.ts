export type Habit = {
  id: string;
  name: string;
  monthly_target: number | null;
  color: string;
  sort: number;
  archived: boolean;
  reminder_time: string | null;
  reminder_event_id: string | null;
};

export type Log = {
  habit_id: string;
  day: string;
  done: boolean;
};

export type Goal = {
  id: string;
  scope: "week" | "month";
  jy: number;
  jm: number;
  slot: number;
  title: string;
  done: boolean;
  deleted: boolean;
};

export type Todo = {
  id: string;
  day: string;
  title: string;
  done: boolean;
  remind_date?: string | null;
  remind_time: string | null;
  event_id: string | null;
  event_type?: "reminder" | "meeting" | null;
  duration_minutes?: number | null;
};

export type Settings = {
  user_id: string;
  script_url?: string | null;
  google_email: string | null;
  calendar_connected?: boolean;
};
