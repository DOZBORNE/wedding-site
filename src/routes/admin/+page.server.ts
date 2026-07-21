import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, GUEST_COLS_FULL } from '$lib/server/supabase';
import { isAdmin, login, logout, makeCode } from '$lib/server/admin';
import { sendAllReminders } from '$lib/server/reminders';
import { sendInvitations } from '$lib/server/invites';
import { sendBroadcast, type Audience, type BroadcastChannel } from '$lib/server/broadcast';
import { smsEnabled } from '$lib/server/sms';
import type { Guest } from '$lib/types';

export type AdminParty = {
	id: string;
	code: string;
	display_name: string;
	contact_email: string;
	contact_phone: string;
	notes: string;
	song_requests: string;
	message: string;
	invited_at: string | null;
	responded_at: string | null;
	reminded_at: string | null;
	guests: Guest[];
};

export const load: PageServerLoad = async ({ cookies }) => {
	if (!isAdmin(cookies)) return { authed: false as const };

	// Run both reads concurrently — one round-trip to Supabase instead of two.
	const [partiesRes, notesRes] = await Promise.all([
		db()
			.from('wed_parties')
			.select(
				`id, code, display_name, contact_email, contact_phone, notes, song_requests, message, invited_at, responded_at, reminded_at, wed_guests ( ${GUEST_COLS_FULL} )`
			)
			.order('display_name'),
		db()
			.from('wed_guestbook')
			.select('id, name, message, approved, created_at')
			.order('created_at', { ascending: false })
	]);
	const parties: AdminParty[] = (partiesRes.data ?? []).map((p) => ({
		...(p as unknown as AdminParty),
		guests: ((p.wed_guests as Guest[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
	}));
	const notes = notesRes.data;

	return {
		authed: true as const,
		parties,
		notes: notes ?? [],
		smsConfigured: smsEnabled()
	};
};

/**
 * One guest per line. Optional contact after pipes:
 *   Jordan Smith | jordan@example.com | +12055551234
 * A trailing `*` (or a bare `*` / `+1`) marks an unclaimed plus-one slot.
 */
function parseGuestLines(raw: string) {
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line, i) => {
			const [namePart = '', emailPart = '', phonePart = ''] = line.split('|').map((s) => s.trim());
			const isPlusOne = namePart === '*' || namePart === '+1' || namePart.endsWith('*');
			const name = namePart === '*' || namePart === '+1' ? '' : namePart.replace(/\*+$/, '').trim();
			const words = name.split(/\s+/).filter(Boolean);
			const first_name = words[0] ?? '';
			const last_name = words.length > 1 ? words.slice(1).join(' ') : '';
			return {
				name,
				first_name,
				last_name,
				email: emailPart.slice(0, 120),
				phone: phonePart.slice(0, 30),
				is_plus_one: isPlusOne,
				sort_order: i
			};
		});
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
		const displayName = String(form.get('display_name') ?? '').trim();
		const guests = parseGuestLines(String(form.get('guests') ?? ''));
		if (!displayName || !guests.length) {
			return fail(400, { partyError: 'A party needs a name and at least one guest.' });
		}
		const fields = {
			display_name: displayName,
			contact_email: String(form.get('contact_email') ?? '').trim(),
			contact_phone: String(form.get('contact_phone') ?? '').trim(),
			notes: String(form.get('notes') ?? '').trim()
		};

		let partyId = id;
		if (id) {
			const { error } = await db().from('wed_parties').update(fields).eq('id', id);
			if (error) return fail(500, { partyError: error.message });
			if (form.get('replace_guests') === 'on') {
				await db().from('wed_guests').delete().eq('party_id', id);
				await db().from('wed_parties').update({ responded_at: null }).eq('id', id);
			} else {
				return {};
			}
		} else {
			const { data, error } = await db()
				.from('wed_parties')
				.insert({ ...fields, code: makeCode() })
				.select('id')
				.single();
			if (error) return fail(500, { partyError: error.message });
			partyId = data.id;
		}

		const { error: guestError } = await db()
			.from('wed_guests')
			.insert(guests.map((g) => ({ ...g, party_id: partyId })));
		if (guestError) return fail(500, { partyError: guestError.message });
		return {};
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
