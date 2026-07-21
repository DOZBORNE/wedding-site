import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, GUEST_COLS } from '$lib/server/supabase';
import { grantParty } from '$lib/server/rsvp-session';
import type { Guest, PublicParty } from '$lib/types';

/**
 * Unlock a party with its invite code. On success we set a party-scoped cookie
 * (so submit trusts this browser) and return the guest list. This is the only
 * path — besides a valid `?code=` deep link — that reveals who's in a party.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => ({}));
	const partyId = String(body.partyId ?? '').trim();
	const code = String(body.code ?? '')
		.trim()
		.toUpperCase();

	if (!partyId || !code) {
		return json({ error: 'Please enter the code from your invitation.' }, { status: 400 });
	}

	const { data } = await db()
		.from('wed_parties')
		.select(`id, code, display_name, responded_at, wed_guests ( ${GUEST_COLS} )`)
		.eq('id', partyId)
		.maybeSingle();

	if (!data || String(data.code).toUpperCase() !== code) {
		return json(
			{ error: "That code doesn't match this invitation. Please check your card or text." },
			{ status: 401 }
		);
	}

	grantParty(cookies, data.id);

	const party: PublicParty = {
		id: data.id,
		display_name: data.display_name,
		responded_at: data.responded_at,
		guests: ((data.wed_guests as Guest[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
	};
	return json({ party });
};
