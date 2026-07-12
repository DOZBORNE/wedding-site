import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, GUEST_COLS } from '$lib/server/supabase';
import { sendRsvpConfirmation } from '$lib/server/email';
import { MEALS } from '$lib/config';
import type { Guest } from '$lib/types';

type SubmitGuest = {
	id: string;
	attending: boolean | null;
	meal: string;
	dietary: string;
	name?: string;
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body?.partyId || !Array.isArray(body.guests)) {
		return json({ error: 'Something went wrong — please refresh and try again.' }, { status: 400 });
	}

	const partyId = String(body.partyId);
	const { data: party } = await db()
		.from('wed_parties')
		.select(`id, display_name, contact_email, wed_guests ( ${GUEST_COLS} )`)
		.eq('id', partyId)
		.maybeSingle();
	if (!party) {
		return json({ error: 'We could not find that invitation.' }, { status: 404 });
	}

	const own = new Map((party.wed_guests as Guest[]).map((g) => [g.id, g]));
	const updates = (body.guests as SubmitGuest[]).filter((g) => own.has(String(g.id)));
	if (!updates.length) {
		return json({ error: 'No guests to update.' }, { status: 400 });
	}

	for (const update of updates) {
		const existing = own.get(String(update.id))!;
		const patch: Record<string, unknown> = {
			attending: update.attending === true ? true : update.attending === false ? false : null,
			meal: MEALS.includes(update.meal) ? update.meal : '',
			dietary: String(update.dietary ?? '').slice(0, 500)
		};
		// only plus-one slots may (re)name themselves
		if (existing.is_plus_one && typeof update.name === 'string') {
			patch.name = update.name.trim().slice(0, 80);
		}
		const { error } = await db().from('wed_guests').update(patch).eq('id', update.id).eq('party_id', partyId);
		if (error) return json({ error: 'Could not save your reply — please try again.' }, { status: 500 });
	}

	const contactEmail = String(body.contactEmail ?? '').trim().slice(0, 120);
	const { error: partyError } = await db()
		.from('wed_parties')
		.update({
			responded_at: new Date().toISOString(),
			song_requests: String(body.songRequests ?? '').slice(0, 500),
			message: String(body.message ?? '').slice(0, 1000),
			...(contactEmail ? { contact_email: contactEmail } : {})
		})
		.eq('id', partyId);
	if (partyError) {
		return json({ error: 'Could not save your reply — please try again.' }, { status: 500 });
	}

	// confirmation email is best-effort; the RSVP is already saved
	const { data: fresh } = await db()
		.from('wed_guests')
		.select(GUEST_COLS)
		.eq('party_id', partyId)
		.order('sort_order');
	const to = contactEmail || (party.contact_email as string);
	if (to) {
		sendRsvpConfirmation(to, party.display_name as string, (fresh as Guest[]) ?? []).catch(() => {});
	}

	return json({ ok: true });
};
