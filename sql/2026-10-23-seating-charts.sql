-- Seating charts — who sits at which table, drawn on a saved pavilion plan.
-- Many charts can share one plan, so different arrangements of the same room
-- can be tried side by side. Guests are referenced by wed_guests.id inside the
-- jsonb rather than by foreign key: a guest deleted from /admin simply drops
-- out of every chart the next time it is opened.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists seating_charts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan_id    uuid not null references pavilion_plans(id) on delete cascade,
  tables     jsonb not null default '{}'::jsonb,  -- { [plan item id]: { name, capacity, guests: [guest id, …] } }, guests in chair order
  no_chair   jsonb not null default '[]'::jsonb,  -- guest ids that sit on a lap and take no chair
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seating_charts_plan_idx on seating_charts (plan_id, created_at desc);

-- Service-role only, like pavilion_plans and the wed_* tables.
alter table seating_charts enable row level security;
