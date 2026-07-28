import { blankAddress, type Guest, type PartyAddress } from '$lib/types';
import { toE164 } from '$lib/phone';

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
} & PartyAddress;

/** The address fields, in the order they're laid out in the editor. */
export const ADDRESS_FIELDS = [
	'address_line1',
	'address_line2',
	'city',
	'state_region',
	'postal_code',
	'country'
] as const;

/** Pull just the address out of a wider record — a party view, a draft, a form. */
export const pickAddress = (src: Partial<PartyAddress>): PartyAddress => {
	const a = blankAddress();
	for (const f of ADDRESS_FIELDS) a[f] = String(src[f] ?? '');
	return a;
};

/** One line, for the party list and for copying onto an envelope. */
export function formatAddress(a: Partial<PartyAddress>): string {
	const street = [a.address_line1, a.address_line2].map((s) => (s ?? '').trim()).filter(Boolean);
	const city = [a.city, a.state_region].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
	const tail = [city, (a.postal_code ?? '').trim()].filter(Boolean).join(' ');
	const country = (a.country ?? '').trim();
	return [...street, tail, country === 'United States' ? '' : country].filter(Boolean).join(' · ');
}

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
	address: PartyAddress;
	guests: GuestDraft[];
};

export const blankGuest = (): GuestDraft => ({ name: '', email: '', phone: '', is_plus_one: false });

export const blankParty = (key: string): PartyDraft => ({
	key,
	display_name: '',
	contact_email: '',
	contact_phone: '',
	notes: '',
	address: blankAddress(),
	guests: [blankGuest()]
});

/** A row with nothing typed in it — silently dropped on save, never an error. */
export const isBlankRow = (g: GuestDraft) =>
	!g.name.trim() && !g.email.trim() && !g.phone.trim() && !g.is_plus_one;

// Email and phone validation live in $lib so the guest-facing RSVP form and the
// submit endpoint judge a plus-one's contact details exactly as the editor does.
// The phone field formats itself as you type, so there's no "start with +1"
// nudge to give any more.
export { emailError } from '$lib/validate';
export { phoneError } from '$lib/phone';

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
				else if (!g.phone && /^[+(]?[\d\s\-().]{7,}$/.test(part)) g.phone = toE164(part) || part;
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
