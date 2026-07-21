import { env } from '$env/dynamic/private';
import { db, GUEST_COLS_FULL } from './supabase';
import { sendUpdate } from './email';
import { sendSms, smsEnabled } from './sms';
import { logMessage, dedupeRecipients } from './messages';
import type { Guest } from '$lib/types';

export type Audience = 'all' | 'responded' | 'attending' | 'pending';
export type BroadcastChannel = 'email' | 'sms' | 'both';

/**
 * Send an update to a chosen slice of parties. Reaches the household contact plus
 * any per-guest contacts. Used for "something changed" news — venue, booking,
 * schedule — the manual counterpart to reminders.
 */
export async function sendBroadcast(opts: {
	audience: Audience;
	channel: BroadcastChannel;
	subject: string;
	message: string;
}) {
	const site = env.PUBLIC_SITE_URL || 'http://localhost:5173';
	const subject = opts.subject.trim().slice(0, 140) || 'An update';
	const message = opts.message.trim().slice(0, 4000);
	if (!message) throw new Error('Message body is required.');

	let q = db()
		.from('wed_parties')
		.select(
			`id, code, display_name, contact_email, contact_phone, responded_at, wed_guests ( ${GUEST_COLS_FULL} )`
		);
	if (opts.audience === 'responded' || opts.audience === 'attending') {
		q = q.not('responded_at', 'is', null);
	} else if (opts.audience === 'pending') {
		q = q.is('responded_at', null);
	}
	const { data: parties, error } = await q;
	if (error) throw new Error(error.message);

	const wantEmail = opts.channel === 'email' || opts.channel === 'both';
	const wantSms = (opts.channel === 'sms' || opts.channel === 'both') && smsEnabled();

	let emails = 0;
	let texts = 0;
	let recipients = 0;

	for (const party of parties ?? []) {
		const guests = (party.wed_guests as Guest[]) ?? [];

		// "attending" means at least one seat accepted.
		if (opts.audience === 'attending' && !guests.some((g) => g.attending === true)) continue;
		recipients++;

		const url = `${site}/rsvp?code=${party.code}`;

		if (wantEmail) {
			const emailTargets = dedupeRecipients([party.contact_email, ...guests.map((g) => g.email)]);
			for (const to of emailTargets) {
				try {
					const id = await sendUpdate(to, party.display_name, subject, message, url);
					if (id !== null) {
						emails++;
						await logMessage({
							party_id: party.id,
							channel: 'email',
							kind: 'update',
							to_address: to,
							provider_id: id,
							body: subject
						});
					}
				} catch {
					/* keep going */
				}
			}
		}

		if (wantSms) {
			const smsBody = `${subject}\n\n${message}\n\n${url} (Reply STOP to opt out)`.slice(0, 1000);
			const phoneTargets = dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)]);
			for (const to of phoneTargets) {
				try {
					const id = await sendSms(to, smsBody);
					if (id !== null) {
						texts++;
						await logMessage({
							party_id: party.id,
							channel: 'sms',
							kind: 'update',
							to_address: to,
							provider_id: id,
							body: subject
						});
					}
				} catch {
					/* keep going */
				}
			}
		}
	}

	return { recipients, emails, texts };
}
