import { env } from '$env/dynamic/private';
import { COUPLE, VENUE, WEDDING } from '$lib/config';
import { db, GUEST_COLS_FULL } from './supabase';
import { sendReminder } from './email';
import { sendSms, smsEnabled } from './sms';
import { logMessage, dedupeRecipients } from './messages';
import type { Guest } from '$lib/types';

/** Don't re-nudge a party that already got a reminder within this many hours. */
const COOLDOWN_HOURS = 48;

/**
 * Nudge every party that hasn't responded. Used by the admin panel button
 * and (optionally) a cron hitting POST /api/reminders. Reminders go to the
 * household contact plus any per-guest contacts, and are skipped for parties
 * reminded within the last COOLDOWN_HOURS (pass force to override).
 */
export async function sendAllReminders(opts: { includeSms: boolean; force?: boolean }) {
	const site = env.PUBLIC_SITE_URL || 'http://localhost:5173';
	const { data: parties, error } = await db()
		.from('wed_parties')
		.select(
			`id, code, display_name, contact_email, contact_phone, reminded_at, wed_guests ( ${GUEST_COLS_FULL} )`
		)
		.is('responded_at', null);
	if (error) throw new Error(error.message);

	const cutoff = Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000;
	let emails = 0;
	let texts = 0;
	let skipped = 0;

	for (const party of parties ?? []) {
		if (!opts.force && party.reminded_at && new Date(party.reminded_at).getTime() > cutoff) {
			skipped++;
			continue;
		}
		const url = `${site}/rsvp?code=${party.code}`;
		const guests = (party.wed_guests as Guest[]) ?? [];

		const emailTargets = dedupeRecipients([party.contact_email, ...guests.map((g) => g.email)]);
		for (const to of emailTargets) {
			try {
				const id = await sendReminder(to, party.display_name, url);
				if (id !== null) {
					emails++;
					await logMessage({
						party_id: party.id,
						channel: 'email',
						kind: 'reminder',
						to_address: to,
						provider_id: id
					});
				}
			} catch {
				/* keep going — one bad address shouldn't stop the batch */
			}
		}

		if (opts.includeSms && smsEnabled()) {
			const body = `${COUPLE.first} & ${COUPLE.partnerFirst} are getting married ${WEDDING.dateLabel} at ${VENUE.name} — please RSVP: ${url} (Reply STOP to opt out)`;
			const phoneTargets = dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)]);
			for (const to of phoneTargets) {
				try {
					const id = await sendSms(to, body);
					if (id !== null) {
						texts++;
						await logMessage({
							party_id: party.id,
							channel: 'sms',
							kind: 'reminder',
							to_address: to,
							provider_id: id,
							body
						});
					}
				} catch {
					/* same */
				}
			}
		}

		await db()
			.from('wed_parties')
			.update({ reminded_at: new Date().toISOString() })
			.eq('id', party.id);
	}

	return { parties: (parties?.length ?? 0) - skipped, emails, texts, skipped };
}
