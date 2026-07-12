import { env } from '$env/dynamic/private';
import { COUPLE, VENUE, WEDDING } from '$lib/config';
import { db } from './supabase';
import { sendReminder } from './email';
import { sendSms, smsEnabled } from './sms';

/**
 * Nudge every party that hasn't responded. Used by the admin panel button
 * and (optionally) a cron hitting POST /api/reminders.
 */
export async function sendAllReminders(opts: { includeSms: boolean }) {
	const site = env.PUBLIC_SITE_URL || 'http://localhost:5173';
	const { data: parties, error } = await db()
		.from('wed_parties')
		.select('id, code, display_name, contact_email, contact_phone')
		.is('responded_at', null);
	if (error) throw new Error(error.message);

	let emails = 0;
	let texts = 0;
	for (const party of parties ?? []) {
		const url = `${site}/rsvp?code=${party.code}`;
		if (party.contact_email) {
			try {
				if (await sendReminder(party.contact_email, party.display_name, url)) emails++;
			} catch {
				/* keep going — one bad address shouldn't stop the batch */
			}
		}
		if (opts.includeSms && smsEnabled() && party.contact_phone) {
			const body = `${COUPLE.first} & ${COUPLE.partnerFirst} are getting married ${WEDDING.dateLabel} at ${VENUE.name} — please RSVP: ${url}`;
			try {
				if (await sendSms(party.contact_phone, body)) texts++;
			} catch {
				/* same */
			}
		}
		await db()
			.from('wed_parties')
			.update({ reminded_at: new Date().toISOString() })
			.eq('id', party.id);
	}
	return { parties: parties?.length ?? 0, emails, texts };
}
