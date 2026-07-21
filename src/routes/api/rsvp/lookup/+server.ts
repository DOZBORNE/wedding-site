import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/supabase';

/**
 * Find candidate parties by a guest's name. Returns ONLY the family name + id —
 * never the guest list. Opening a party requires the invite code (see /api/rsvp/open),
 * so a name guess can't read or overwrite anyone's RSVP.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const query = String(body.query ?? '').trim();

	if (query.length < 3) {
		return json(
			{ parties: [], error: 'Please enter at least three letters of a name.' },
			{ status: 400 }
		);
	}

	const like = `%${query.replace(/[%_]/g, '')}%`;

	// match on guest names first, then party display names
	const { data: guestHits } = await db()
		.from('wed_guests')
		.select('party_id')
		.ilike('name', like)
		.limit(20);
	const ids = [...new Set((guestHits ?? []).map((g) => g.party_id))];

	const { data: byName } = await db()
		.from('wed_parties')
		.select('id, display_name')
		.ilike('display_name', like)
		.limit(5);

	let byGuest: { id: string; display_name: string }[] = [];
	if (ids.length) {
		const res = await db().from('wed_parties').select('id, display_name').in('id', ids).limit(8);
		byGuest = res.data ?? [];
	}

	const seen = new Set<string>();
	const parties = [...byGuest, ...(byName ?? [])]
		.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
		.slice(0, 8)
		.map((p) => ({ id: p.id, display_name: p.display_name }));

	return json({ parties });
};
