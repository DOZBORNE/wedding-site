import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/supabase';
import type { PartyCandidate } from '$lib/types';

/**
 * Find candidate parties by a guest's or household's name.
 *
 * Returns the family name plus *masked* member names — "Devin O.", never
 * "Devin Osborne" — and a count of any open plus-one seats. That's the minimum
 * needed to tell two households both called "The Osborne Party" apart, and it's
 * all a name guess ever gets: opening a party still requires the invite code
 * (see /api/rsvp/open), so nobody can read or overwrite someone else's RSVP.
 */

/** "Devin Osborne" → "Devin O." · a single-word name is left as-is. */
function mask(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return '';
	if (words.length === 1) return words[0];
	return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}

/** Words that appear on nearly every invitation — matching them returns everyone. */
const STOP = new Set(['the', 'and', 'party', 'family', 'mr', 'mrs', 'ms', 'dr', 'guest']);

/**
 * People type "osborne" when the invitation says "The Osborne Party", and
 * "devin and jess" when it says "Devin Osborne". So we match the whole phrase
 * *and* each meaningful word in it, and let anything that hits come back — the
 * point of the chooser is that they don't have to type it exactly.
 */
function patterns(query: string): string[] {
	const clean = query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
	const words = clean.split(' ').filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
	return [...new Set([clean, ...words])].filter((p) => p.length >= 3).slice(0, 6);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const query = String(body.query ?? '').trim();

	if (query.length < 3) {
		return json(
			{ parties: [], error: 'Please enter at least three letters of a name.' },
			{ status: 400 }
		);
	}

	const terms = patterns(query);
	if (!terms.length) return json({ parties: [] });

	const guestFilter = terms.map((t) => `name.ilike.%${t}%`).join(',');
	const partyFilter = terms.map((t) => `display_name.ilike.%${t}%`).join(',');

	// match on guest names and on party display names, in one round trip
	const [guestHits, partyHits] = await Promise.all([
		db().from('wed_guests').select('party_id').or(guestFilter).limit(40),
		db().from('wed_parties').select('id').or(partyFilter).limit(12)
	]);

	const ids = [
		...new Set([
			...(guestHits.data ?? []).map((g) => g.party_id as string),
			...(partyHits.data ?? []).map((p) => p.id as string)
		])
	].slice(0, 8);

	if (!ids.length) return json({ parties: [] });

	// One read fills in the display name and the masked roster for every hit.
	const { data: found } = await db()
		.from('wed_parties')
		.select('id, display_name, wed_guests ( name, is_plus_one, sort_order )')
		.in('id', ids);

	type Row = { name: string; is_plus_one: boolean; sort_order: number };
	const parties: PartyCandidate[] = (found ?? [])
		.map((p) => {
			const guests = ((p.wed_guests as Row[]) ?? []).sort((a, b) => a.sort_order - b.sort_order);
			return {
				id: p.id as string,
				display_name: p.display_name as string,
				members: guests.map((g) => mask(g.name)).filter(Boolean),
				// unnamed plus-one seats show as a count rather than a blank row
				plus_ones: guests.filter((g) => g.is_plus_one && !g.name.trim()).length
			};
		})
		.sort((a, b) => a.display_name.localeCompare(b.display_name));

	return json({ parties });
};
