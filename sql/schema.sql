-- Devin & Jessica wedding — Supabase schema
-- Runs alongside the engagement-invite tables in the same project.
-- Run in the Supabase SQL Editor.

-- Enables the trigram index used for guest-name search. Must come before that index.
create extension if not exists pg_trgm;

create table if not exists wed_parties (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,           -- invite code, e.g. 'K7M2PQ'
  display_name   text not null,                  -- "The Smith Party"
  contact_email  text not null default '',
  contact_phone  text not null default '',
  notes          text not null default '',       -- private admin notes
  song_requests  text not null default '',
  message        text not null default '',       -- note from the party on RSVP
  invited_at     timestamptz,                    -- when the invitation was sent
  responded_at   timestamptz,
  reminded_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists wed_guests (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references wed_parties(id) on delete cascade,
  name         text not null default '',         -- display name, empty for an unclaimed plus-one slot
  first_name   text not null default '',
  last_name    text not null default '',
  email        text not null default '',         -- optional per-person contact (household default lives on the party)
  phone        text not null default '',
  is_plus_one  boolean not null default false,
  attending    boolean,                          -- null = no answer yet
  meal         text not null default '',
  dietary      text not null default '',
  sort_order   int not null default 0
);

-- Every outbound email/text, for idempotent reminders + a delivery record in /admin.
create table if not exists wed_messages (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid references wed_parties(id) on delete cascade,
  guest_id    uuid references wed_guests(id) on delete set null,
  channel     text not null,                     -- 'email' | 'sms'
  kind        text not null,                     -- 'invite' | 'reminder' | 'update' | 'confirmation'
  to_address  text not null,
  status      text not null default 'sent',      -- 'sent' | 'failed'
  provider_id text not null default '',          -- Resend / Twilio message id
  body        text not null default '',
  created_at  timestamptz not null default now()
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
create index if not exists idx_wed_messages_party on wed_messages(party_id, kind, created_at desc);

-- ── Migration for an existing install (safe to re-run) ────────────────────────
-- If wed_guests/wed_parties already exist from an earlier version, add the new
-- columns and table. `create table if not exists` above is a no-op on old DBs,
-- so these fill the gap.
alter table wed_parties add column if not exists invited_at timestamptz;
alter table wed_guests add column if not exists first_name text not null default '';
alter table wed_guests add column if not exists last_name  text not null default '';
alter table wed_guests add column if not exists email      text not null default '';
alter table wed_guests add column if not exists phone      text not null default '';

-- RLS: same pattern as the engagement site — no policies means the anon key
-- gets nothing; only the service role (used server-side) can read/write.
alter table wed_parties enable row level security;
alter table wed_guests enable row level security;
alter table wed_guestbook enable row level security;
alter table wed_messages enable row level security;
