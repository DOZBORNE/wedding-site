import { COUPLE, VENUE, WEDDING } from '$lib/config';
import { db, GUEST_COLS_FULL } from './supabase';
import { sendInvite } from './email';
import { sendSms, smsEnabled } from './sms';
import { logMessage, dedupeRecipients, alreadyInvited } from './messages';
import { siteUrl } from './site';
import type { Guest } from '$lib/types';

/**
 * Send the invitation to every party (or only those not yet invited). Reaches the
 * household contact plus any per-guest contacts, logs each send, and stamps
 * `invited_at` so the default "not yet invited" run never double-sends.
 *
 * The stamp alone isn't enough: a send that fails halfway (a provider hiccup, a
 * rate limit) leaves the party unstamped, and the next run would re-invite the
 * people who *did* get through. So an "uninvited" run also skips any address the
 * message log already shows an invitation for. Only "all" — an explicit re-send —
 * ignores that.
 */
export async function sendInvitations(opts: {
	includeSms: boolean;
	audience: 'uninvited' | 'all';
}) {
	const site = siteUrl();
	let q = db()
		.from('wed_parties')
		.select(
			`id, code, display_name, contact_email, contact_phone, invited_at, wed_guests ( ${GUEST_COLS_FULL} )`
		);
	if (opts.audience === 'uninvited') q = q.is('invited_at', null);
	const { data: parties, error } = await q;
	if (error) throw new Error(error.message);

	const resend = opts.audience === 'all';
	// One read of the log covers the whole batch.
	const sentBefore = resend
		? new Set<string>()
		: await alreadyInvited((parties ?? []).map((p) => p.id as string));

	let emails = 0;
	let texts = 0;
	let failed = 0;
	let skipped = 0;
	let sampleError = '';

	const note = (e: unknown, fallback: string) => {
		failed++;
		if (!sampleError) sampleError = e instanceof Error ? e.message : fallback;
	};

	for (const party of parties ?? []) {
		// Lands at the top of the site, not on a bare form — the code opens their
		// envelope once they've scrolled down to it.
		const url = `${site}/?code=${party.code}`;
		const guests = (party.wed_guests as Guest[]) ?? [];
		let partySent = 0;
		let partyFailed = 0;
		let partySkipped = 0;

		const fresh = (channel: 'email' | 'sms', to: string) =>
			!sentBefore.has(`${party.id}|${channel}|${to.toLowerCase()}`);

		const emailTargets = dedupeRecipients([party.contact_email, ...guests.map((g) => g.email)]);
		for (const to of emailTargets) {
			if (!fresh('email', to)) {
				skipped++;
				partySkipped++;
				continue;
			}
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
				partyFailed++;
				note(e, 'Email failed to send.');
			}
		}

		if (opts.includeSms && smsEnabled()) {
			const body = `You're invited! ${COUPLE.first} & ${COUPLE.partnerFirst} are getting married ${WEDDING.dateLabel} at ${VENUE.name}. Please RSVP: ${url} (Reply STOP to opt out)`;
			const phoneTargets = dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)]);
			for (const to of phoneTargets) {
				if (!fresh('sms', to)) {
					skipped++;
					partySkipped++;
					continue;
				}
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
					partyFailed++;
				}
			}
		}

		// Mark the party invited once everything that was meant to go out did —
		// including the case where every address was already covered by an earlier
		// run, which is how a party stuck at "sent but never stamped" heals itself
		// without emailing anyone twice. A party whose send failed stays "not
		// invited" and gets picked up next run, minus whoever already got through.
		if ((partySent > 0 || partySkipped > 0) && partyFailed === 0 && !party.invited_at) {
			const { error: stampError } = await db()
				.from('wed_parties')
				.update({ invited_at: new Date().toISOString() })
				.eq('id', party.id);
			if (stampError) {
				note(
					new Error(`${party.display_name} was invited but couldn't be marked: ${stampError.message}`),
					'Could not mark the party as invited.'
				);
			}
		}
	}

	return { parties: parties?.length ?? 0, emails, texts, failed, skipped, error: sampleError };
}
