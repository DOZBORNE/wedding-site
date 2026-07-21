import type { Guest } from '$lib/types';

/** A party as the admin page sees it — full contact info, RSVP state, timestamps. */
export type AdminPartyView = {
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

export type GuestDraft = {
	/** Present on guests that already exist in the database. */
	id?: string;
	name: string;
	email: string;
	phone: string;
	is_plus_one: boolean;
	/** RSVP state carried along for display in the editor — never edited there. */
	attending?: boolean | null;
	meal?: string;
	dietary?: string;
};

export type PartyDraft = {
	/** Stable client-side key — the party id for edits, a random id for new drafts. */
	key: string;
	display_name: string;
	contact_email: string;
	contact_phone: string;
	notes: string;
	guests: GuestDraft[];
};

export const blankGuest = (): GuestDraft => ({ name: '', email: '', phone: '', is_plus_one: false });

export const blankParty = (key: string): PartyDraft => ({
	key,
	display_name: '',
	contact_email: '',
	contact_phone: '',
	notes: '',
	guests: [blankGuest()]
});

/** A row with nothing typed in it — silently dropped on save, never an error. */
export const isBlankRow = (g: GuestDraft) =>
	!g.name.trim() && !g.email.trim() && !g.phone.trim() && !g.is_plus_one;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneDigits = (v: string) => v.replace(/[\s\-().]/g, '');

export const emailError = (v: string) =>
	v.trim() && !EMAIL_RE.test(v.trim()) ? 'This doesn’t look like an email address.' : '';

export const phoneError = (v: string) =>
	v.trim() && !/^\+?\d{7,15}$/.test(phoneDigits(v.trim()))
		? 'This doesn’t look like a phone number.'
		: '';

/** Texts need E.164 — a soft nudge, never a blocker. */
export const phoneWarning = (v: string) =>
	v.trim() && !phoneError(v) && !v.trim().startsWith('+')
		? 'Texts need the international format — start with +1.'
		: '';

/**
 * Turn pasted lines — a spreadsheet selection, "Name<TAB>email<TAB>phone",
 * "Name | email | phone", or comma-separated lines — into guest rows.
 * Tokens are classified by shape: @ → email, digits → phone, the rest joins
 * into the name. A trailing * (or a bare * / +1) marks a plus-one slot.
 */
export function parsePastedGuests(text: string): GuestDraft[] {
	return text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((line) => {
			const sep = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ',';
			const parts = line
				.split(sep)
				.map((s) => s.trim())
				.filter(Boolean);
			const g = blankGuest();
			const nameParts: string[] = [];
			for (const part of parts) {
				if (!g.email && part.includes('@')) g.email = part;
				else if (!g.phone && /^[+(]?[\d\s\-().]{7,}$/.test(part)) g.phone = part;
				else nameParts.push(part);
			}
			let name = nameParts.join(' ');
			if (name === '*' || name === '+1') {
				g.is_plus_one = true;
				name = '';
			} else if (name.endsWith('*')) {
				g.is_plus_one = true;
				name = name.replace(/\*+$/, '').trim();
			}
			g.name = name;
			return g;
		});
}
