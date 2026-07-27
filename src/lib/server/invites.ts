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

	const smsOn = opts.includeSms && smsEnabled();

	let emails = 0;
	let texts = 0;
	let failed = 0;
	let skipped = 0;
	let sampleError = '';
	// Parties this run can't reach at all — no email, and no phone we're able to
	// text. They're not failures and not successes; without counting them they'd
	// just vanish from the tally and look invited.
	const unreachable: string[] = [];

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
		const phoneTargets = smsOn
			? dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)])
			: [];

		// Nothing to send to. Say so rather than looping over two empty lists and
		// reporting the party as handled — a phone-only household with texts turned
		// off would otherwise pass through in total silence.
		if (!emailTargets.length && !phoneTargets.length) {
			unreachable.push(party.display_name as string);
			continue;
		}

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
				await logMessage({
					party_id: party.id,
					channel: 'email',
					kind: 'invite',
					to_address: to,
					status: 'failed',
					body: e instanceof Error ? e.message : 'Email failed to send.'
				});
			}
		}

		if (phoneTargets.length) {
			// Keep this body plain ASCII, and keep it short. Two separate traps:
			//
			// 1. Anything outside the GSM-7 alphabet — an em dash, a curly apostrophe,
			//    an ellipsis, an emoji — silently re-encodes the *whole* message as
			//    UCS-2, which cuts the per-segment budget from 160 characters to 70.
			//    One decorative character can triple the segment count.
			// 2. At 160 GSM-7 characters it splits into two segments. With the site's
			//    URL and a ~6-char code that leaves very little slack, so a longer
			//    domain or a wordier greeting tips it over.
			//
			// Neither shows up anywhere but the Twilio bill, so check both before
			// editing. Nothing breaks if it does split — it just costs double.
			const body = `You're invited! ${COUPLE.first} & ${COUPLE.partnerFirst} are getting married ${WEDDING.dateLabel} at ${VENUE.name}. RSVP: ${url} (Reply STOP to opt out)`;
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
				} catch (e) {
					// Same treatment as a bounced email: counted, reported, and it
					// holds back the `invited_at` stamp so the next run retries this
					// number instead of writing it off as delivered.
					partyFailed++;
					note(e, 'Text failed to send.');
					await logMessage({
						party_id: party.id,
						channel: 'sms',
						kind: 'invite',
						to_address: to,
						status: 'failed',
						body: e instanceof Error ? e.message : 'Text failed to send.'
					});
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

	return {
		parties: (parties?.length ?? 0) - unreachable.length,
		emails,
		texts,
		failed,
		skipped,
		unreachable: unreachable.length,
		// A few names are enough to go fix the list; the full set would swamp the panel.
		unreachableNames: unreachable.slice(0, 5),
		error: sampleError
	};
}
