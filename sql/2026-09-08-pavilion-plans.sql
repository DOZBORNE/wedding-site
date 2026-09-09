-- Pavilion seating planner — table layouts for the reception.
-- Deliberately standalone: nothing here references or touches the wed_* RSVP
-- tables, and nothing in those tables references this one.
-- Run in the Supabase SQL Editor.

create table if not exists pavilion_plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  seats      int not null default 0,          -- denormalised for the list; recomputed on save
  items      jsonb not null default '[]'::jsonb,  -- tables, zones: centre in feet, size, rotation, seats
  spacing    jsonb not null default '{}'::jsonb,  -- the clearance rule the plan was drawn against
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pavilion_plans_created_at_idx on pavilion_plans (created_at desc);

-- Reached only through the service-role key in src/routes/api/seating, exactly
-- like the wed_* tables. RLS on with no policies denies every anon/authenticated
-- request outright.
alter table pavilion_plans enable row level security;
