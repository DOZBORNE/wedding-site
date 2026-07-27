import { db, GUEST_COLS } from './supabase';
import type { Guest, PartyAddress, PublicParty } from '$lib/types';

/** Address columns, as stored. Shared so a new field can't be added to one query and forgotten in another. */
export const ADDRESS_COLS =
	'address_line1, address_line2, city, state_region, postal_code, country';

/** Everything a guest who holds the code is allowed to see about their own party. */
export const PARTY_COLS = `id, display_name, responded_at, song_requests, message, contact_email, ${ADDRESS_COLS}`;

type Row = Record<string, unknown>;

const str = (v: unknown) => String(v ?? '');

export function rowAddress(row: Row): PartyAddress {
	return {
		address_line1: str(row.address_line1),
		address_line2: str(row.address_line2),
		city: str(row.city),
		state_region: str(row.state_region),
		postal_code: str(row.postal_code),
		country: str(row.country)
	};
}

/** Shape a `wed_parties` row (joined with its guests) into the object the RSVP form reads. */
export function toPublicParty(row: Row): PublicParty {
	return {
		id: str(row.id),
		display_name: str(row.display_name),
		responded_at: (row.responded_at as string | null) ?? null,
		song_requests: str(row.song_requests),
		message: str(row.message),
		contact_email: str(row.contact_email),
		address: rowAddress(row),
		guests: ((row.wed_guests as Guest[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
	};
}

async function fetchParty(column: 'code' | 'id', value: string): Promise<PublicParty | null> {
	const { data } = await db()
		.from('wed_parties')
		.select(`${PARTY_COLS}, wed_guests ( ${GUEST_COLS} )`)
		.eq(column, value)
		.maybeSingle();
	return data ? toPublicParty(data as Row) : null;
}

/**
 * Resolve an invite code from a `?code=` link. Tolerates a missing or misconfigured
 * database the same way the rest of the site does — the page still renders, the
 * visitor just falls back to looking their party up by name.
 */
export async function partyByCode(code: string): Promise<PublicParty | null> {
	const clean = code.trim().toUpperCase();
	if (!clean) return null;
	try {
		return await fetchParty('code', clean);
	} catch {
		return null;
	}
}

/** Resolve a party the browser already holds a signed session cookie for. */
export async function partyById(id: string): Promise<PublicParty | null> {
	if (!id) return null;
	try {
		return await fetchParty('id', id);
	} catch {
		return null;
	}
}
