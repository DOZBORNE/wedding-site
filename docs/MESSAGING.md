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
  provider id). Powers idempotent reminders and a record of what went out. Refused sends
  are logged with `status='failed'` and Twilio's/Resend's own error text in `body`; only
  `status='sent'` rows suppress a re-send, so a failure always gets retried.

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
  Phone fields format themselves as you type — "2177791753" becomes "(217) 779-1753" — and
  store `+E.164` for Twilio. Numbers outside the US are typed with their own country code
  ("+44 20 7123 4567").
- **Send invitations** — emails each party's contact plus any per-guest contacts. Defaults
  to parties **not yet invited**. Two things keep it from double-sending: the `invited_at`
  stamp, and `wed_messages` — an address that already has an `invite` logged for that party
  is skipped, so re-running after a batch that died halfway only catches the stragglers.
  "Everyone — re-send" ignores both, on purpose. Sends are paced under Resend's 2/second
  limit and retry once when throttled.

  Before you press send, the panel shows **who this run can actually reach** — "Reaches 38
  of 42 parties — 31 by email, 24 by text" — and flags the two ways a party falls out:
  a phone number but no email with texts switched off, and no contact of any kind. Those
  parties are skipped explicitly, named in the result, and left "not invited"; they used to
  pass through the batch in silence and count as handled. The party list marks them too
  (`no phone`, `no contact` chips).
- **Send invitation → Email / Text** at the foot of a party's own editor — one household,
  one channel, for a bounced address or a party added after the batch went out. Deliberately
  *not* deduped against `wed_messages`: it's a resend button, so pressing it twice sends
  twice. It still stamps `invited_at` if the party wasn't stamped and nothing failed, and it
  sends whatever is **saved** — save the party first if you just changed a contact.
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
5. **Make that From address receive mail.** Resend only needs `send.<domain>` to send, but a
   domain that sends and cannot receive looks like throwaway spam infrastructure, and guests
   are told to "just reply to this email". We use improvmx.com (free); Cloudflare Email
   Routing is an equally good option since the zone is on Cloudflare already. Point MX at it:
   ```
   rsvp.yourdomain.com.  MX  10  mx1.improvmx.com.
   rsvp.yourdomain.com.  MX  20  mx2.improvmx.com.
   ```
   Also add ImprovMX's SPF at **`rsvp`**, never at `@` — the zone root carries its own
   `v=spf1 -all` and two SPF records on one name is a PERMERROR, i.e. worse than none:
   ```
   rsvp.yourdomain.com.  TXT  "v=spf1 include:spf.improvmx.com ~all"
   ```
   This does not disturb sending — that runs through the separate `send.rsvp.yourdomain.com`,
   which is the envelope domain SPF is actually checked against.
   We send **no Reply-To header** on purpose: a Reply-To on a different organisational domain
   than the From is a classic phishing pattern and was costing us the inbox. Replies are
   routed with MX instead. Send yourself an invite and reply to it before any bulk send.

### Twilio (SMS) — start early, approval takes days
1. Sign up, upgrade from trial (add a card).
2. Buy a **toll-free** number (~$2/mo).
3. Messaging → Regulatory Compliance → **Toll-Free Verification**. Use case: personal
   wedding RSVP notifications to invited guests; include a sample message with the RSVP
   link and "Reply STOP to opt out"; volume = lowest tier. Approval ~3–14 business days.
4. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER=+1888…` (E.164) —
   in `.env` *and* in Vercel. Empty values mean `smsEnabled()` is false, the "also send
   texts" checkbox never renders, and phone-only parties are reported as unreachable.
   Twilio auto-handles STOP/HELP for toll-free.
5. Send yourself a test first — add a party with just your own number and invite it. A
   number Twilio refuses (unverified sender, trial account, no credit) now surfaces the
   error in the panel rather than silently counting as delivered.

### Every env var → also add in Vercel
Set `PUBLIC_SITE_URL` to the real domain or reminder/deep links break. It has to keep the
`PUBLIC_` prefix and be read through `$env/dynamic/public` (`$lib/server/site.ts` does this)
— `$env/dynamic/private` drops `PUBLIC_*` variables, which once left every emailed RSVP
button pointing at `http://localhost:5173`. `SITE_URL` (unprefixed) works as an override, and
Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` is the last-resort fallback. The Invitations
panel in `/admin` shows the URL it's about to send, and warns in red if it's a local one.

### Database
Run `sql/schema.sql` in the Supabase SQL editor. It's safe to re-run — the migration
block adds the new guest columns and `wed_messages` to an existing install.

---

## Possible next steps (not yet built)
- Delivery webhooks (Resend/Twilio → update `wed_messages.status` on bounce/deliver).
- Auto-fire an `update` email when admin changes a party's booking/seating.
- Rate-limit `/api/rsvp/lookup` to slow name enumeration.
