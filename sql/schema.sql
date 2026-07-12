-- Devin & Jessica wedding — Supabase schema
-- Runs alongside the engagement-invite tables in the same project.
-- Run in the Supabase SQL Editor.

create table if not exists wed_parties (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,           -- invite code, e.g. 'K7M2PQ'
  display_name   text not null,                  -- "The Smith Party"
  contact_email  text not null default '',
  contact_phone  text not null default '',
  notes          text not null default '',       -- private admin notes
  song_requests  text not null default '',
  message        text not null default '',       -- note from the party on RSVP
  responded_at   timestamptz,
  reminded_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists wed_guests (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references wed_parties(id) on delete cascade,
  name         text not null default '',         -- empty for an unclaimed plus-one slot
  is_plus_one  boolean not null default false,
  attending    boolean,                          -- null = no answer yet
  meal         text not null default '',
  dietary      text not null default '',
  sort_order   int not null default 0
);

create table if not exists wed_guestbook (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  approved    boolean not null default false,    -- moderated in /admin
  created_at  timestamptz not null default now()
);

create index if not exists idx_wed_guests_party on wed_guests(party_id);
create index if not exists idx_wed_guests_name on wed_guests using gin (name gin_trgm_ops);
create index if not exists idx_wed_parties_code on wed_parties(code);
create index if not exists idx_wed_guestbook_created on wed_guestbook(created_at desc);

-- The trigram index needs the extension (skip the index above if you'd rather not):
-- create extension if not exists pg_trgm;

-- RLS: same pattern as the engagement site — no policies means the anon key
-- gets nothing; only the service role (used server-side) can read/write.
alter table wed_parties enable row level security;
alter table wed_guests enable row level security;
alter table wed_guestbook enable row level security;
