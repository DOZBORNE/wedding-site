import type { Guest } from '$lib/types';
import type { AdminPartyView } from './party-form';

/** The three piles every invited guest lands in, and the two things they write back. */
export type Pile = 'accepting' | 'declining' | 'awaiting';
export type LedgerView = Pile | 'songs' | 'notes';

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
	songs: SongRow[];
	notes: NoteRow[];
};

export const VIEWS: { id: LedgerView; label: string }[] = [
	{ id: 'accepting', label: 'Accepting' },
	{ id: 'declining', label: 'Declining' },
	{ id: 'awaiting', label: 'Awaiting' },
	{ id: 'songs', label: 'Songs' },
	{ id: 'notes', label: 'Notes' }
];

const pileOf = (g: Guest): Pile =>
	g.attending === true ? 'accepting' : g.attending === false ? 'declining' : 'awaiting';

/**
 * Every reply, sorted into piles. Parties arrive ordered by name and their guests
 * by seat order, so the lists come out in the same order as the party list below —
 * scanning the pop-out and scanning the page feel like the same document.
 */
export function buildLedger(parties: AdminPartyView[]): Ledger {
	const ledger: Ledger = { accepting: [], declining: [], awaiting: [], songs: [], notes: [] };
	for (const party of parties) {
		for (const guest of party.guests) {
			ledger[pileOf(guest)].push({ key: guest.id, guest, party });
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
	hay(r.guest.name, r.party.display_name, r.party.code, r.guest.dietary, r.party.message);
export const songHay = (r: SongRow) => hay(r.text, r.party.display_name, r.party.code);
export const noteHay = (r: NoteRow) => hay(r.text, r.party.display_name, r.party.code, r.kind);

/** The song list as plain text, one party per line — paste straight into a playlist doc. */
export const songsAsText = (rows: SongRow[]) =>
	rows.map((r) => `${r.party.display_name} — ${r.text.replace(/\s*\n\s*/g, '; ')}`).join('\n');
