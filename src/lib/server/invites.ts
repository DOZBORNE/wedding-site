import { env } from '$env/dynamic/private';
import { COUPLE, VENUE, WEDDING } from '$lib/config';
import { db, GUEST_COLS_FULL } from './supabase';
import { sendInvite } from './email';
import { sendSms, smsEnabled } from './sms';
import { logMessage, dedupeRecipients } from './messages';
import type { Guest } from '$lib/types';

/**
 * Send the invitation to every party (or only those not yet invited). Reaches the
 * household contact plus any per-guest contacts, logs each send, and stamps
 * `invited_at` so the default "not yet invited" run never double-sends.
 */
export async function sendInvitations(opts: {
	includeSms: boolean;
	audience: 'uninvited' | 'all';
}) {
	const site = env.PUBLIC_SITE_URL || 'http://localhost:5173';
	let q = db()
		.from('wed_parties')
		.select(
			`id, code, display_name, contact_email, contact_phone, invited_at, wed_guests ( ${GUEST_COLS_FULL} )`
		);
	if (opts.audience === 'uninvited') q = q.is('invited_at', null);
	const { data: parties, error } = await q;
	if (error) throw new Error(error.message);

	let emails = 0;
	let texts = 0;
	let failed = 0;
	let sampleError = '';

	for (const party of parties ?? []) {
		const url = `${site}/rsvp?code=${party.code}`;
		const guests = (party.wed_guests as Guest[]) ?? [];
		let partySent = 0;

		const emailTargets = dedupeRecipients([party.contact_email, ...guests.map((g) => g.email)]);
		for (const to of emailTargets) {
			try {
				const id = await sendInvite(to, party.display_name, url);
				if (id !== null) {
					emails++;
					partySent++;
					await logMessage({
						party_id: party.id,
						channel: 'email',
						kind: 'invite',
						to_address: to,
						provider_id: id
					});
				}
			} catch (e) {
				// keep going — one bad address shouldn't stop the batch — but remember why.
				failed++;
				if (!sampleError) sampleError = e instanceof Error ? e.message : 'Email failed to send.';
			}
		}

		if (opts.includeSms && smsEnabled()) {
			const body = `You're invited! ${COUPLE.first} & ${COUPLE.partnerFirst} are getting married ${WEDDING.dateLabel} at ${VENUE.name}. Please RSVP: ${url} (Reply STOP to opt out)`;
			const phoneTargets = dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)]);
			for (const to of phoneTargets) {
				try {
					const id = await sendSms(to, body);
					if (id !== null) {
						texts++;
						partySent++;
						await logMessage({
							party_id: party.id,
							channel: 'sms',
							kind: 'invite',
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

		// Only mark invited if something actually went out — so a failed send stays "not invited".
		if (partySent > 0) {
			await db()
				.from('wed_parties')
				.update({ invited_at: new Date().toISOString() })
				.eq('id', party.id);
		}
	}

	return { parties: parties?.length ?? 0, emails, texts, failed, error: sampleError };
}
