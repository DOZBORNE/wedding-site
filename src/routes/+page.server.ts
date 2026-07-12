import type { PageServerLoad } from './$types';
import { db } from '$lib/server/supabase';
import type { GuestbookEntry } from '$lib/types';

export const load: PageServerLoad = async () => {
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
	return { guestbook };
};
