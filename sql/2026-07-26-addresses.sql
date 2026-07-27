-- Mailing addresses on parties — required part of the guest RSVP form.
-- Run this once in the Supabase SQL Editor. Safe to re-run.
--
-- (These same statements also live in schema.sql, so a fresh install picks them
-- up automatically; this file is just the delta for the database that's already
-- running.)

alter table wed_parties add column if not exists address_line1 text not null default '';
alter table wed_parties add column if not exists address_line2 text not null default '';
alter table wed_parties add column if not exists city          text not null default '';
alter table wed_parties add column if not exists state_region  text not null default '';
alter table wed_parties add column if not exists postal_code   text not null default '';
alter table wed_parties add column if not exists country       text not null default '';
