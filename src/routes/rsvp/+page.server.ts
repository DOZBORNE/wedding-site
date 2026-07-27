import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The RSVP now lives on the main site, inside the sealed envelope, so an
 * invitation link walks the guest through the whole story on the way down to it.
 * This route only survives to catch invitations and texts that already went out
 * with a `/rsvp?code=` link — it hands the code to the home page and steps aside.
 */
export const load: PageServerLoad = async ({ url }) => {
	const code = url.searchParams.get('code')?.trim();
	redirect(302, code ? `/?code=${encodeURIComponent(code)}` : '/#rsvp');
};
