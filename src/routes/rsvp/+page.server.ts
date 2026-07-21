import type { PageServerLoad } from './$types';
import { db, GUEST_COLS } from '$lib/server/supabase';
import { grantParty } from '$lib/server/rsvp-session';
import type { Guest, PublicParty } from '$lib/types';

/** Deep link from reminder emails/texts: /rsvp?code=ABC123 skips the lookup. The
 *  code in the URL is itself the credential, so we also mint the party session. */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const code = url.searchParams.get('code')?.trim().toUpperCase();
	let party: PublicParty | null = null;
	if (code) {
		try {
			const { data } = await db()
				.from('wed_parties')
				.select(`id, display_name, responded_at, wed_guests ( ${GUEST_COLS} )`)
				.eq('code', code)
				.maybeSingle();
			if (data) {
				grantParty(cookies, data.id);
				party = {
					id: data.id,
					display_name: data.display_name,
					responded_at: data.responded_at,
					guests: ((data.wed_guests as Guest[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
				};
			}
		} catch {
			party = null;
		}
	}
	return { party };
};
