import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const name = String(body?.name ?? '').trim().slice(0, 80);
	const message = String(body?.message ?? '').trim().slice(0, 1000);
	// honeypot — bots fill every field
	if (body?.website) return json({ ok: true });
	if (!name || message.length < 3) {
		return json({ error: 'Please add your name and a note.' }, { status: 400 });
	}
	const { error } = await db().from('wed_guestbook').insert({ name, message });
	if (error) return json({ error: 'Could not save your note — please try again.' }, { status: 500 });
	return json({ ok: true });
};
