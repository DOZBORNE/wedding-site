import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, GUEST_COLS } from '$lib/server/supabase';
import type { PublicParty } from '$lib/types';

const PARTY_COLS = `id, display_name, responded_at, wed_guests ( ${GUEST_COLS} )`;

function publicParty(row: Record<string, unknown>): PublicParty {
	const guests = (row.wed_guests as PublicParty['guests']) ?? [];
	return {
		id: row.id as string,
		display_name: row.display_name as string,
		responded_at: (row.responded_at as string) ?? null,
		guests: guests.sort((a, b) => a.sort_order - b.sort_order)
	};
}

/** Find a party by invite code or by a guest's name. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const code = String(body.code ?? '').trim();
	const query = String(body.query ?? '').trim();

	if (code) {
		const { data } = await db()
			.from('wed_parties')
			.select(PARTY_COLS)
			.eq('code', code.toUpperCase())
			.maybeSingle();
		return json({ parties: data ? [publicParty(data)] : [] });
	}

	if (query.length < 3) {
		return json({ parties: [], error: 'Please enter at least three letters of a name.' }, { status: 400 });
	}

	// match on guest names first, then party display names
	const like = `%${query.replace(/[%_]/g, '')}%`;
	const { data: guestHits } = await db()
		.from('wed_guests')
		.select('party_id')
		.ilike('name', like)
		.limit(10);
	const ids = [...new Set((guestHits ?? []).map((g) => g.party_id))];

	const { data: byName } = await db()
		.from('wed_parties')
		.select(PARTY_COLS)
		.ilike('display_name', like)
		.limit(5);

	let byGuest: typeof byName = [];
	if (ids.length) {
		const res = await db().from('wed_parties').select(PARTY_COLS).in('id', ids).limit(5);
		byGuest = res.data ?? [];
	}

	const seen = new Set<string>();
	const parties = [...(byGuest ?? []), ...(byName ?? [])]
		.filter((p) => (seen.has(p.id as string) ? false : (seen.add(p.id as string), true)))
		.slice(0, 5)
		.map(publicParty);

	return json({ parties });
};
