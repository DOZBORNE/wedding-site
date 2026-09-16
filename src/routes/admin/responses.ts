import { toAgeGroup, type Guest } from '$lib/types';
import type { AdminPartyView } from './party-form';

/** The three piles every invited guest lands in, and the two things they write back. */
export type Pile = 'accepting' | 'declining' | 'awaiting';
export type LedgerView = Pile | 'kids' | 'songs' | 'notes';

export type GuestRow = { key: string; guest: Guest; party: AdminPartyView };
export type SongRow = { key: string; party: AdminPartyView; text: string };
/** RSVP notes are what the household wrote; private notes are what the couple wrote about them. */
export type NoteRow = {
	key: string;
	party: AdminPartyView;
	text: string;
	kind: 'rsvp' | 'private';
};

export type Ledger = {
	accepting: GuestRow[];
	declining: GuestRow[];
	awaiting: GuestRow[];
	/** Everyone marked child or baby, whatever they answered — also filed in their answer pile. */
	kids: GuestRow[];
	songs: SongRow[];
	notes: NoteRow[];
};

export const VIEWS: { id: LedgerView; label: string }[] = [
	{ id: 'accepting', label: 'Accepting' },
	{ id: 'declining', label: 'Declining' },
	{ id: 'awaiting', label: 'Awaiting' },
	{ id: 'kids', label: 'Kids' },
	{ id: 'songs', label: 'Songs' },
	{ id: 'notes', label: 'Notes' }
];

export const pileOf = (g: Guest): Pile =>
	g.attending === true ? 'accepting' : g.attending === false ? 'declining' : 'awaiting';

/**
 * Newest reply first. `responded_at` is re-stamped every time a household submits,
 * so it doubles as an updated-at; parties that haven't replied at all sink to the
 * bottom. Ties keep their arrival order (parties by name, guests by seat).
 */
const byMostRecentReply = (a: GuestRow, b: GuestRow) => {
	const ta = a.party.responded_at ? Date.parse(a.party.responded_at) : 0;
	const tb = b.party.responded_at ? Date.parse(b.party.responded_at) : 0;
	return tb - ta;
};

const KID_ORDER: Record<Pile, number> = { accepting: 0, awaiting: 1, declining: 2 };

/**
 * Every reply, sorted into piles. The three answer piles are ordered by most recent
 * reply, so what just came in sits at the top. Songs and notes keep the party list's
 * order (parties by name, guests by seat), so scanning the pop-out and scanning the
 * page feel like the same document.
 */
export function buildLedger(parties: AdminPartyView[]): Ledger {
	const ledger: Ledger = {
		accepting: [],
		declining: [],
		awaiting: [],
		kids: [],
		songs: [],
		notes: []
	};
	for (const party of parties) {
		for (const guest of party.guests) {
			const row = { key: guest.id, guest, party };
			ledger[pileOf(guest)].push(row);
			if (toAgeGroup(guest.age_group) !== 'adult') ledger.kids.push(row);
		}
		if (party.song_requests.trim()) {
			ledger.songs.push({ key: party.id, party, text: party.song_requests.trim() });
		}
		if (party.message.trim()) {
			ledger.notes.push({ key: `rsvp-${party.id}`, party, text: party.message.trim(), kind: 'rsvp' });
		}
		if (party.notes.trim()) {
			ledger.notes.push({
				key: `private-${party.id}`,
				party,
				text: party.notes.trim(),
				kind: 'private'
			});
		}
	}
	ledger.accepting.sort(byMostRecentReply);
	ledger.declining.sort(byMostRecentReply);
	ledger.awaiting.sort(byMostRecentReply);
	// Coming first, then not yet answered, then not coming — the top of the list is
	// who the caterer and the seating chart need to hear about.
	ledger.kids.sort((a, b) => KID_ORDER[pileOf(a.guest)] - KID_ORDER[pileOf(b.guest)]);
	// RSVP notes first — the guests' own words are what you came to read.
	ledger.notes.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'rsvp' ? -1 : 1));
	return ledger;
}

export const countOf = (ledger: Ledger, view: LedgerView) => ledger[view].length;

/** One case-folded haystack per row, so the search box matches guest, party, code, and text alike. */
const hay = (...parts: (string | null | undefined)[]) =>
	parts
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

/** The note is in the haystack too — searching a phrase you half-remember finds the person who wrote it. */
export const guestHay = (r: GuestRow) =>
	hay(
		r.guest.name,
		r.party.display_name,
		r.party.code,
		r.guest.dietary,
		r.party.message,
		toAgeGroup(r.guest.age_group) === 'adult' ? '' : r.guest.age_group
	);
export const songHay = (r: SongRow) => hay(r.text, r.party.display_name, r.party.code);
export const noteHay = (r: NoteRow) => hay(r.text, r.party.display_name, r.party.code, r.kind);

/** The song list as plain text, one party per line — paste straight into a playlist doc. */
export const songsAsText = (rows: SongRow[]) =>
	rows.map((r) => `${r.party.display_name} — ${r.text.replace(/\s*\n\s*/g, '; ')}`).join('\n');
