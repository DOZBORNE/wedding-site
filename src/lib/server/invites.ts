import { COUPLE, VENUE, WEDDING } from '$lib/config';
import { db, GUEST_COLS_FULL } from './supabase';
import { sendInvite } from './email';
import { sendSms, smsEnabled } from './sms';
import { logMessage, dedupeRecipients, alreadyInvited } from './messages';
import { siteUrl } from './site';
import type { Guest } from '$lib/types';

const INVITE_COLS = `id, code, display_name, contact_email, contact_phone, invited_at, wed_guests ( ${GUEST_COLS_FULL} )`;

type InviteParty = {
	id: string;
	code: string;
	display_name: string;
	contact_email: string | null;
	contact_phone: string | null;
	invited_at: string | null;
	wed_guests?: Guest[] | null;
};

type PartyTally = {
	emails: number;
	texts: number;
	failed: number;
	skipped: number;
	error: string;
	/** No address at all on the channels this run was allowed to use. */
	unreachable: boolean;
};

/**
 * One party's invitation, on whichever channels the caller opened. Shared by the
 * batch run and the single-party send in the admin, so both log the same way and
 * stamp `invited_at` under the same rule.
 */
async function invitePartyOnce(
	party: InviteParty,
	site: string,
	opts: { email: boolean; sms: boolean; sentBefore: Set<string> }
): Promise<PartyTally> {
	// Lands at the top of the site, not on a bare form — the code opens their
	// envelope once they've scrolled down to it.
	const url = `${site}/?code=${party.code}`;
	const guests = party.wed_guests ?? [];
	let emails = 0;
	let texts = 0;
	let failed = 0;
	let skipped = 0;
	let error = '';

	const note = (e: unknown, fallback: string) => {
		failed++;
		if (!error) error = e instanceof Error ? e.message : fallback;
	};
	const fresh = (channel: 'email' | 'sms', to: string) =>
		!opts.sentBefore.has(`${party.id}|${channel}|${to.toLowerCase()}`);

	const emailTargets = opts.email
		? dedupeRecipients([party.contact_email, ...guests.map((g) => g.email)])
		: [];
	const phoneTargets = opts.sms
		? dedupeRecipients([party.contact_phone, ...guests.map((g) => g.phone)])
		: [];

	// Nothing to send to. Say so rather than looping over two empty lists and
	// reporting the party as handled — a phone-only household with texts turned
	// off would otherwise pass through in total silence.
	if (!emailTargets.length && !phoneTargets.length) {
		return { emails: 0, texts: 0, failed: 0, skipped: 0, error: '', unreachable: true };
	}

	for (const to of emailTargets) {
		if (!fresh('email', to)) {
			skipped++;
			continue;
		}
		try {
			const id = await sendInvite(to, party.display_name, url);
			if (id !== null) {
				emails++;
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
				continue;
			}
			try {
				const id = await sendSms(to, body);
				if (id !== null) {
					texts++;
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
	if (emails + texts + skipped > 0 && failed === 0 && !party.invited_at) {
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

	return { emails, texts, failed, skipped, error, unreachable: false };
}

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
	let q = db().from('wed_parties').select(INVITE_COLS);
	if (opts.audience === 'uninvited') q = q.is('invited_at', null);
	const { data, error } = await q;
	if (error) throw new Error(error.message);
	const parties = (data ?? []) as unknown as InviteParty[];

	const resend = opts.audience === 'all';
	// One read of the log covers the whole batch.
	const sentBefore = resend ? new Set<string>() : await alreadyInvited(parties.map((p) => p.id));

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

	for (const party of parties) {
		const tally = await invitePartyOnce(party, site, {
			email: true,
			sms: smsOn,
			sentBefore
		});
		if (tally.unreachable) {
			unreachable.push(party.display_name);
			continue;
		}
		emails += tally.emails;
		texts += tally.texts;
		failed += tally.failed;
		skipped += tally.skipped;
		if (!sampleError) sampleError = tally.error;
	}

	return {
		parties: parties.length - unreachable.length,
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

/**
 * One party, one channel, sent by hand from the party editor. Unlike the batch run
 * this is always deliberate — the message log isn't consulted, so pressing it twice
 * really does send twice. That's the point of a resend button.
 */
export async function sendInvitationToParty(opts: {
	partyId: string;
	channel: 'email' | 'sms';
}): Promise<PartyTally & { name: string }> {
	if (opts.channel === 'sms' && !smsEnabled()) {
		throw new Error('Texting is off until Twilio is configured.');
	}
	const { data, error } = await db()
		.from('wed_parties')
		.select(INVITE_COLS)
		.eq('id', opts.partyId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) throw new Error('That party no longer exists — reload the page.');

	const party = data as unknown as InviteParty;
	const tally = await invitePartyOnce(party, siteUrl(), {
		email: opts.channel === 'email',
		sms: opts.channel === 'sms',
		sentBefore: new Set()
	});
	return { ...tally, name: party.display_name };
}
