import type { PageServerLoad } from './$types';
import { db } from '$lib/server/supabase';
import { partyByCode, partyById } from '$lib/server/party';
import { grantParty, sessionPartyId } from '$lib/server/rsvp-session';
import type { GuestbookEntry, PublicParty } from '$lib/types';

/**
 * The invitation deep link (`/?code=ABC123`) lands here, at the top of the site,
 * so the email walks everyone through the whole story before they reach the
 * envelope. The code is itself the credential, so resolving it also mints the
 * party session — which is what lets the RSVP section greet them by name.
 *
 * With no code we fall back to that session cookie: someone who already opened
 * their invitation on this device finds it open again on the next visit, even
 * after the code has been stripped from the address bar.
 */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');

	let party: PublicParty | null = null;
	if (code) {
		party = await partyByCode(code);
		if (party) grantParty(cookies, party.id);
	}
	if (!party) {
		const known = sessionPartyId(cookies);
		if (known) party = await partyById(known);
	}

	// tolerate a not-yet-configured database so the site still renders in dev
	let guestbook: GuestbookEntry[] = [];
	try {
		const { data } = await db()
			.from('wed_guestbook')
			.select('id, name, message, created_at')
			.eq('approved', true)
			.order('created_at', { ascending: false })
			.limit(30);
		guestbook = (data as GuestbookEntry[]) ?? [];
	} catch {
		guestbook = [];
	}

	return { guestbook, party, hasCodeInUrl: !!code };
};
