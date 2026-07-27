import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, GUEST_COLS_FULL } from '$lib/server/supabase';
import { ADDRESS_COLS } from '$lib/server/party';
import { isAdmin, login, logout, makeCode } from '$lib/server/admin';
import { sendAllReminders } from '$lib/server/reminders';
import { sendInvitations } from '$lib/server/invites';
import { sendBroadcast, type Audience, type BroadcastChannel } from '$lib/server/broadcast';
import { smsEnabled } from '$lib/server/sms';
import { siteUrl, siteUrlIsLocal } from '$lib/server/site';
import { toE164 } from '$lib/phone';
import type { Guest } from '$lib/types';
import { ADDRESS_FIELDS, type AdminPartyView } from './party-form';

export const load: PageServerLoad = async ({ cookies }) => {
	if (!isAdmin(cookies)) return { authed: false as const };

	// Run the reads concurrently — one round-trip to Supabase instead of three.
	const [partiesRes, notesRes, inviteLogRes] = await Promise.all([
		db()
			.from('wed_parties')
			.select(
				`id, code, display_name, contact_email, contact_phone, notes, song_requests, message, ${ADDRESS_COLS}, invited_at, responded_at, reminded_at, wed_guests ( ${GUEST_COLS_FULL} )`
			)
			.order('display_name'),
		db()
			.from('wed_guestbook')
			.select('id, name, message, approved, created_at')
			.order('created_at', { ascending: false }),
		// Who an invitation actually reached — a party can have sends logged without
		// being stamped "invited" if part of the batch failed.
		db().from('wed_messages').select('party_id').eq('kind', 'invite').eq('status', 'sent').limit(5000)
	]);
	const parties: AdminPartyView[] = (partiesRes.data ?? []).map((p) => ({
		...(p as unknown as AdminPartyView),
		guests: ((p.wed_guests as Guest[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
	}));
	const notes = notesRes.data;
	const partlySent = [...new Set((inviteLogRes.data ?? []).map((m) => m.party_id as string))].filter(
		(id) => !parties.find((p) => p.id === id)?.invited_at
	);

	return {
		authed: true as const,
		parties,
		notes: notes ?? [],
		smsConfigured: smsEnabled(),
		partlySent,
		siteUrl: siteUrl(),
		siteUrlIsLocal: siteUrlIsLocal()
	};
};

type IncomingGuest = {
	id?: string;
	name: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	is_plus_one: boolean;
	sort_order: number;
};

/** Store phones as +E.164 whatever the editor sent — Twilio takes nothing else. */
const canonPhone = (v: unknown) => {
	const raw = String(v ?? '')
		.trim()
		.slice(0, 30);
	return toE164(raw) || raw;
};

/** Parse the editor's guests_json payload. Returns null when the shape is wrong. */
function readGuests(raw: string): IncomingGuest[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed) || parsed.length > 40) return null;
	const guests: IncomingGuest[] = [];
	for (const [i, item] of parsed.entries()) {
		if (typeof item !== 'object' || item === null) return null;
		const g = item as Record<string, unknown>;
		const name = String(g.name ?? '')
			.trim()
			.slice(0, 120);
		const words = name.split(/\s+/).filter(Boolean);
		guests.push({
			id: typeof g.id === 'string' && g.id ? g.id : undefined,
			name,
			first_name: words[0] ?? '',
			last_name: words.length > 1 ? words.slice(1).join(' ') : '',
			email: String(g.email ?? '')
				.trim()
				.slice(0, 120),
			phone: canonPhone(g.phone),
			is_plus_one: g.is_plus_one === true,
			sort_order: i
		});
	}
	return guests;
}

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		if (!login(cookies, String(form.get('password') ?? ''))) {
			return fail(401, { loginError: 'Wrong password.' });
		}
	},

	logout: async ({ cookies }) => {
		logout(cookies);
	},

	saveParty: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { partyError: 'Not signed in.' });
		const form = await request.formData();
		const id = String(form.get('id') ?? '').trim();
		const displayName = String(form.get('display_name') ?? '')
			.trim()
			.slice(0, 120);
		const guests = readGuests(String(form.get('guests_json') ?? ''));

		if (!guests) {
			return fail(400, { partyError: 'The guest list could not be read — reload and try again.' });
		}
		if (!displayName) return fail(400, { partyError: 'The party needs a name.' });
		if (!guests.length) return fail(400, { partyError: 'Add at least one guest.' });
		if (guests.some((g) => !g.name && !g.is_plus_one)) {
			return fail(400, {
				partyError: 'Every guest needs a name — or mark the row as a plus-one slot.'
			});
		}

		// Addresses are optional here — the couple can add one by hand, but the
		// guest's own RSVP is what usually fills them in.
		const address = Object.fromEntries(
			ADDRESS_FIELDS.map((f) => [
				f,
				String(form.get(f) ?? '')
					.trim()
					.slice(0, 200)
			])
		);

		const fields = {
			display_name: displayName,
			contact_email: String(form.get('contact_email') ?? '')
				.trim()
				.slice(0, 120),
			contact_phone: canonPhone(form.get('contact_phone')),
			notes: String(form.get('notes') ?? '')
				.trim()
				.slice(0, 2000),
			...address
		};

		// New party: insert it and its guests, done.
		if (!id) {
			const { data, error } = await db()
				.from('wed_parties')
				.insert({ ...fields, code: makeCode() })
				.select('id')
				.single();
			if (error) return fail(500, { partyError: error.message });
			const { error: guestError } = await db()
				.from('wed_guests')
				.insert(guests.map(({ id: _ignored, ...g }) => ({ ...g, party_id: data.id })));
			if (guestError) return fail(500, { partyError: guestError.message });
			return { saved: true };
		}

		const { error } = await db().from('wed_parties').update(fields).eq('id', id);
		if (error) return fail(500, { partyError: error.message });

		// Diff the guest list against what's stored: kept guests update in place
		// (their RSVP survives), new rows insert, missing rows delete.
		const { data: existing, error: readError } = await db()
			.from('wed_guests')
			.select('id')
			.eq('party_id', id);
		if (readError) return fail(500, { partyError: readError.message });
		const known = new Set((existing ?? []).map((g) => g.id as string));
		const keep = new Set(
			guests.map((g) => g.id).filter((gid): gid is string => !!gid && known.has(gid))
		);

		const toDelete = [...known].filter((gid) => !keep.has(gid));
		if (toDelete.length) {
			const { error: delError } = await db().from('wed_guests').delete().in('id', toDelete);
			if (delError) return fail(500, { partyError: delError.message });
		}

		const updates = guests
			.filter((g) => g.id && keep.has(g.id))
			.map((g) => ({ ...g, party_id: id }));
		if (updates.length) {
			// Upsert on the primary key touches only these columns — attending,
			// meal, and dietary stay exactly as the guest answered.
			const { error: upError } = await db().from('wed_guests').upsert(updates);
			if (upError) return fail(500, { partyError: upError.message });
		}

		const inserts = guests
			.filter((g) => !g.id || !keep.has(g.id))
			.map(({ id: _ignored, ...g }) => ({ ...g, party_id: id }));
		if (inserts.length) {
			const { error: insError } = await db().from('wed_guests').insert(inserts);
			if (insError) return fail(500, { partyError: insError.message });
		}
		return { saved: true };
	},

	deleteParty: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { partyError: 'Not signed in.' });
		const form = await request.formData();
		await db().from('wed_parties').delete().eq('id', String(form.get('id')));
	},

	setNote: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { partyError: 'Not signed in.' });
		const form = await request.formData();
		const id = String(form.get('id'));
		const action = String(form.get('do'));
		if (action === 'delete') await db().from('wed_guestbook').delete().eq('id', id);
		else await db().from('wed_guestbook').update({ approved: action === 'approve' }).eq('id', id);
	},

	invite: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { partyError: 'Not signed in.' });
		const form = await request.formData();
		const audience = form.get('audience') === 'all' ? 'all' : 'uninvited';
		try {
			const result = await sendInvitations({ includeSms: form.get('sms') === 'on', audience });
			return { inviteResult: result };
		} catch (e) {
			return fail(500, { inviteError: e instanceof Error ? e.message : 'Invitation run failed.' });
		}
	},

	remind: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { partyError: 'Not signed in.' });
		const form = await request.formData();
		try {
			const result = await sendAllReminders({ includeSms: form.get('sms') === 'on' });
			return { remindResult: result };
		} catch (e) {
			return fail(500, { remindError: e instanceof Error ? e.message : 'Reminder run failed.' });
		}
	},

	broadcast: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403, { broadcastError: 'Not signed in.' });
		const form = await request.formData();
		const subject = String(form.get('subject') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		const audience = String(form.get('audience') ?? 'all') as Audience;
		const channel = String(form.get('channel') ?? 'email') as BroadcastChannel;
		if (!subject || !message) {
			return fail(400, { broadcastError: 'A subject and a message are both required.' });
		}
		try {
			const result = await sendBroadcast({ audience, channel, subject, message });
			return { broadcastResult: result };
		} catch (e) {
			return fail(500, { broadcastError: e instanceof Error ? e.message : 'Broadcast failed.' });
		}
	}
};
