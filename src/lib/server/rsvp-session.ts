import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

/**
 * A short-lived, party-scoped cookie proving the visitor entered the right invite
 * code. Name lookup only reveals family names; opening a party (or arriving via a
 * `?code=` deep link) mints this cookie, and RSVP submit refuses without it.
 */

const COOKIE = 'wed_rsvp';

/** Signing secret — dedicated var if set, else derived from the service role key so it always works. */
function secret(): string {
	return (
		env.RSVP_SESSION_SECRET ||
		env.SUPABASE_SERVICE_ROLE_KEY ||
		env.ADMIN_PASSWORD ||
		'wed-rsvp-fallback'
	);
}

function sign(partyId: string): string {
	return createHmac('sha256', secret()).update(partyId).digest('hex');
}

/** Grant this browser access to `partyId` for 30 days. */
export function grantParty(cookies: Cookies, partyId: string) {
	cookies.set(COOKIE, `${partyId}.${sign(partyId)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 30
	});
}

/**
 * The party this browser has already unlocked, or null. Lets the home page
 * re-open someone's invitation on a later visit — after the `?code=` has been
 * stripped from the address bar, or when they simply come back a week later.
 */
export function sessionPartyId(cookies: Cookies): string | null {
	const raw = cookies.get(COOKIE);
	if (!raw) return null;
	const dot = raw.lastIndexOf('.');
	if (dot < 0) return null;
	const id = raw.slice(0, dot);
	const mac = raw.slice(dot + 1);
	if (!id) return null;
	const expected = sign(id);
	if (mac.length !== expected.length) return null;
	return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? id : null;
}

/** Does this browser hold a valid token for `partyId`? */
export function hasParty(cookies: Cookies, partyId: string): boolean {
	return !!partyId && sessionPartyId(cookies) === partyId;
}
