import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'wed_admin';

function token(): string {
	if (!env.ADMIN_PASSWORD) throw new Error('Missing ADMIN_PASSWORD — see .env.example');
	return createHash('sha256').update(`wed:${env.ADMIN_PASSWORD}`).digest('hex');
}

export function isAdmin(cookies: Cookies): boolean {
	const value = cookies.get(COOKIE);
	if (!value || !env.ADMIN_PASSWORD) return false;
	const a = Buffer.from(value);
	const b = Buffer.from(token());
	return a.length === b.length && timingSafeEqual(a, b);
}

export function login(cookies: Cookies, password: string): boolean {
	if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) return false;
	cookies.set(COOKIE, token(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 30
	});
	return true;
}

export function logout(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

/** Short, unambiguous invite codes (no 0/O/1/I). */
export function makeCode(): string {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
	return out;
}
