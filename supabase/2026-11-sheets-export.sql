-- ==============================================================
-- One-way Google Sheets export (ADR-001, option B).
-- Run once in Supabase > SQL Editor. Safe to run more than once.
-- ==============================================================

-- The spreadsheet the app created for this user; months are written as tabs in it.
alter table user_settings add column if not exists export_spreadsheet_id text;
