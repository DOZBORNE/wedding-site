-- Per-guest age group, set by hand in /admin: children eat less, and babies may
-- not need a seat at all. Admin-only — never sent to a guest's browser.
-- Run this once in the Supabase SQL Editor. Safe to re-run.
--
-- (Also in schema.sql, so a fresh install picks it up; this file is the delta
-- for the database that's already running.)

alter table wed_guests add column if not exists age_group text not null default 'adult';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wed_guests_age_group_check') then
    alter table wed_guests
      add constraint wed_guests_age_group_check check (age_group in ('adult', 'child', 'baby'));
  end if;
end $$;
