# Guest messaging & RSVP — how it works and how to run it

Everything is self-hosted on your own site (SvelteKit + Supabase + Resend + Twilio).
No Evite/third-party — you own the data. This doc is the operational reference.

## The model

- **`wed_parties`** = one invitation / one "envelope" / one family. Has a unique 6-char
  `code`, a household `contact_email` + `contact_phone`, and shared RSVP state
  (`responded_at`, `song_requests`, `message`).
- **`wed_guests`** = the seats in a party. Each guest has `name` (+ optional
  `first_name`/`last_name`/`email`/`phone`), `attending`, `meal`, `dietary`. A guest
  with `is_plus_one` can name themselves on the RSVP.
- **`wed_messages`** = a log of every email/text sent (channel, kind, recipient,
  provider id). Powers idempotent reminders and a record of what went out.

RSVP state is **shared across the whole party**: anyone in the family opens the same
card, sees everyone's answers, and can edit until the deadline.

## Access & security (name → code)

1. Homepage/RSVP card: guest types a name → lookup returns **only family names**
   (`/api/rsvp/lookup`, no guest data).
2. Guest picks their family → is asked for the **invite code** from their card/text.
3. `/api/rsvp/open` verifies the code, sets a signed party-scoped cookie, and returns
   the guest list. RSVP submit (`/api/rsvp/submit`) refuses without that cookie.
4. The `/rsvp?code=ABC123` deep link in every email/text is the frictionless path — the
   code in the URL is the credential, so it opens the card in one tap.

A name guess alone reveals nothing but a family name and can't read or overwrite an RSVP.

## Deadline

`WEDDING.rsvpDeadlineISO` in `src/lib/config.ts` is enforced server-side — after it,
guest submits are rejected. The couple can still edit any party from `/admin`.
Keep `rsvpDeadlineLabel` (display) and `rsvpDeadlineISO` (enforced) in sync.

## Admin — `/admin`

Password from `ADMIN_PASSWORD`. You can:
- Add/edit parties. Guests are structured rows (name / email / phone / `+1` toggle for a
  plus-one slot); pasting a multi-line or tab-separated list into a name field fans it out
  into rows. Edits diff against the stored list, so renaming or re-contacting a guest never
  resets their RSVP. New-party drafts persist in the browser until saved.
  Per-guest email/phone is **optional** — leave it off to just text the household contact.
- **Send reminders** — emails/texts every party that hasn't responded (skips anyone
  reminded in the last 48h). Reaches household + per-guest contacts.
- **Send an update** — broadcast a message (venue change, booking, schedule) to a chosen
  audience (everyone / responded / attending / pending) over email, text, or both.

Optional cron: `POST /api/reminders` with `Authorization: Bearer $CRON_SECRET`.

---

## Setup runbook

### Resend (email) — ~20 min
1. Sign up at resend.com (free: 3k emails/mo).
2. Domains → Add Domain → add the DKIM/SPF (and DMARC) DNS records it shows.
3. API Keys → create → `RESEND_API_KEY=re_...`.
4. `RESEND_FROM="Devin & Jessica <rsvp@yourdomain.com>"` (must be on the verified domain).

### Twilio (SMS) — start early, approval takes days
1. Sign up, upgrade from trial (add a card).
2. Buy a **toll-free** number (~$2/mo).
3. Messaging → Regulatory Compliance → **Toll-Free Verification**. Use case: personal
   wedding RSVP notifications to invited guests; include a sample message with the RSVP
   link and "Reply STOP to opt out"; volume = lowest tier. Approval ~3–14 business days.
4. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER=+1888…` (E.164).
   Twilio auto-handles STOP/HELP for toll-free.

### Every env var → also add in Vercel
Set `PUBLIC_SITE_URL` to the real domain or reminder/deep links break.

### Database
Run `sql/schema.sql` in the Supabase SQL editor. It's safe to re-run — the migration
block adds the new guest columns and `wed_messages` to an existing install.

---

## Possible next steps (not yet built)
- Delivery webhooks (Resend/Twilio → update `wed_messages.status` on bounce/deliver).
- Auto-fire an `update` email when admin changes a party's booking/seating.
- Rate-limit `/api/rsvp/lookup` to slow name enumeration.
