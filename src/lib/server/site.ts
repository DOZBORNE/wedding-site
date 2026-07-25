import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

const vercelUrl = (host?: string) => (host ? `https://${host}` : '');

/**
 * The absolute base URL every emailed/texted RSVP link is built from.
 *
 * `$env/dynamic/private` deliberately drops anything starting with `PUBLIC_`, so
 * reading `PUBLIC_SITE_URL` from it always yielded undefined and every invitation
 * shipped a `http://localhost:5173` link — fine on the laptop that sent it, dead on
 * a phone. It has to come from the public module. `SITE_URL` and Vercel's own
 * system variables are backstops so a missing env var can't do that again.
 */
export function siteUrl(): string {
	const raw =
		publicEnv.PUBLIC_SITE_URL ||
		privateEnv.SITE_URL ||
		vercelUrl(privateEnv.VERCEL_PROJECT_PRODUCTION_URL) ||
		vercelUrl(privateEnv.VERCEL_URL) ||
		'http://localhost:5173';
	return raw.trim().replace(/\/+$/, '');
}

/** True when links would point somewhere only the sender's machine can open. */
export function siteUrlIsLocal(): boolean {
	return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(siteUrl());
}
