# Devin & Jessica — wedding site

November 6, 2026 · Aldridge Gardens, Hoover, Alabama.

SvelteKit (Svelte 5) + Tailwind v4 + Supabase + Resend (+ optional Twilio SMS), deployed on Vercel.

## Setup

1. **Env** — `cp .env.example .env` and fill it in (reuses the engagement-invite Supabase project).
2. **Database** — run `sql/schema.sql` in the Supabase SQL Editor (adds `wed_*` tables next to the engagement ones).
3. **Run** — `npm install && npm run dev`

## Content to personalize

Everything editable lives in **`src/lib/config.ts`** — story chapters, timeline years, FAQ,
travel info, wedding party names, meals, RSVP deadline. Items marked `TODO` are placeholders.

**Photos:** drop files in `static/photos/` and set the `src` fields in `config.ts`
(`HERO_PHOTO`, `GALLERY`, chapter `plates`, wedding-party portraits). Anything without a `src`
renders as a painted placeholder plate.

## RSVP model

- `wed_parties` — one row per invitation (auto-generated 6-char code, contact email/phone).
- `wed_guests` — the seats you allocate: named guests plus optional plus-one slots (`*` lines in admin).
- Guests find their party by name (or land on `/rsvp?code=XXXXXX` from a reminder link) and can
  only answer for the seats they were given. Submitting sends a Resend confirmation email.

## Admin — `/admin`

Password from `ADMIN_PASSWORD`. Dashboard (counts + meals), party management, guest-list editing,
guestbook moderation, and a **Send reminders now** button (email, plus SMS when Twilio is configured).

Reminder emails/texts deep-link each party to `/rsvp?code=…`.

### Optional cron reminders

`POST /api/reminders` with header `Authorization: Bearer $CRON_SECRET` does the same as the admin
button. Wire it to a Vercel cron if you want automatic nudges — manual is the safer default.

## SMS (Twilio)

Fill the three `TWILIO_*` vars to enable. US carriers require sender registration
(toll-free verification is the simple path) — start that early; approval takes a few days.

## Deploy (Vercel)

Import the repo in Vercel, add every var from `.env`, done. The adapter is already set.
Remember to point `PUBLIC_SITE_URL` at the real domain so reminder links work.
