import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, GUEST_COLS } from '$lib/server/supabase';
import { PARTY_COLS, toPublicParty } from '$lib/server/party';
import { grantParty } from '$lib/server/rsvp-session';

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
		.select(`${PARTY_COLS}, code, wed_guests ( ${GUEST_COLS} )`)
		.eq('id', partyId)
		.maybeSingle();

	if (!data || String(data.code).toUpperCase() !== code) {
		return json(
			{ error: "That code doesn't match this invitation. Please check your card or text." },
			{ status: 401 }
		);
	}

	grantParty(cookies, data.id as string);

	return json({ party: toPublicParty(data) });
};
