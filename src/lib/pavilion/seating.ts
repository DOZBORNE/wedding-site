import type { PlanItem, SeatGuest, SeatingChart, TableSeating } from './types';
import { surfaceAt, type Surface } from './venue';

/** Guests who start every new chart on a lap rather than in a chair. */
export const NO_CHAIR_BY_DEFAULT = ['Avery Osborne'];

export const MAX_TABLE_CAPACITY = 14;

/** dataTransfer type for guests dragged from the list or a table drawer. Payload: JSON guest ids. */
export const GUEST_DRAG_TYPE = 'application/x-seat-guests';

/** A guest table on the plan that can actually seat someone. */
export function isSeatable(item: PlanItem): boolean {
	return item.category === 'guestTable' && item.seats > 0;
}

const SURFACE_ORDER: Record<Surface, number> = { pavilion: 0, patio: 1, grounds: 2 };

/**
 * Seatable tables in reading order, with the number a guest would see on the
 * table card: the pavilion first, row by row from the kitchen side, then the
 * patio top to bottom, then anything out on the grounds. Rows are 10 ft bands,
 * which matches the column bays closely enough that a rank reads as one row.
 */
export function numberedTables(items: PlanItem[]): { item: PlanItem; number: number }[] {
	const surface = (item: PlanItem) => SURFACE_ORDER[surfaceAt(item.x, item.y)];
	return items
		.filter(isSeatable)
		.sort(
			(a, b) =>
				surface(a) - surface(b) ||
				(surface(a) === SURFACE_ORDER.pavilion ? Math.round(a.y / 10) - Math.round(b.y / 10) || a.x - b.x : a.y - b.y)
		)
		.map((item, index) => ({ item, number: index + 1 }));
}

export function blankTable(): TableSeating {
	return { name: '', capacity: null, guests: [] };
}

export function capacityOf(item: PlanItem, seating: TableSeating | undefined): number {
	return seating?.capacity ?? item.seats;
}

/** How many chairs a list of guests fills, leaving out anyone on a lap. */
export function chairsFilled(guestIds: string[], noChair: ReadonlySet<string>): number {
	return guestIds.reduce((total, id) => total + (noChair.has(id) ? 0 : 1), 0);
}

/** Where each guest is sitting, by table item id. */
export function tableOfGuest(tables: Record<string, TableSeating>): Map<string, string> {
	const where = new Map<string, string>();
	for (const [tableId, seating] of Object.entries(tables)) {
		for (const guestId of seating.guests) where.set(guestId, tableId);
	}
	return where;
}

/**
 * Seat the given guests at a table, taking them out of wherever they were.
 * Guests already at that table keep their chairs; newcomers go on the end.
 */
export function seatGuests(
	tables: Record<string, TableSeating>,
	guestIds: string[],
	tableId: string | null
): Record<string, TableSeating> {
	const moving = new Set(guestIds);
	const next: Record<string, TableSeating> = {};
	for (const [id, seating] of Object.entries(tables)) {
		next[id] = id === tableId ? { ...seating } : { ...seating, guests: seating.guests.filter((guest) => !moving.has(guest)) };
	}
	if (tableId) {
		const target = next[tableId] ?? blankTable();
		const already = new Set(target.guests);
		next[tableId] = { ...target, guests: [...target.guests, ...guestIds.filter((id) => !already.has(id))] };
	}
	return next;
}

/** Trade everyone (and the table's name) between two tables. Capacities stay with the furniture. */
export function swapTables(
	tables: Record<string, TableSeating>,
	firstId: string,
	secondId: string
): Record<string, TableSeating> {
	const first = tables[firstId] ?? blankTable();
	const second = tables[secondId] ?? blankTable();
	return {
		...tables,
		[firstId]: { ...first, name: second.name, guests: [...second.guests] },
		[secondId]: { ...second, name: first.name, guests: [...first.guests] }
	};
}

export interface PartyGroup {
	partyId: string;
	partyName: string;
	guests: SeatGuest[];
}

/** Attending guests gathered back into their parties, in the party's own order. */
export function groupByParty(guests: SeatGuest[]): PartyGroup[] {
	const parties = new Map<string, PartyGroup>();
	for (const guest of guests) {
		const party = parties.get(guest.partyId) ?? { partyId: guest.partyId, partyName: guest.partyName, guests: [] };
		party.guests.push(guest);
		parties.set(guest.partyId, party);
	}
	for (const party of parties.values()) party.guests.sort((a, b) => a.sortOrder - b.sortOrder);
	return [...parties.values()];
}

/**
 * Seat every unseated party without splitting it. A party with members already
 * at a table joins them if there's room; otherwise the fullest table that still
 * fits takes them, which leaves the big empty tables for the big parties.
 * Biggest parties go first. Anyone who fits nowhere stays unseated.
 */
export function autoFill(
	items: PlanItem[],
	tables: Record<string, TableSeating>,
	guests: SeatGuest[],
	noChair: ReadonlySet<string>
): { tables: Record<string, TableSeating>; seated: number; leftOver: number } {
	let next = tables;
	const order = numberedTables(items).map(({ item }) => item);
	const open = (item: PlanItem) =>
		capacityOf(item, next[item.id]) - chairsFilled(next[item.id]?.guests ?? [], noChair);

	const where = tableOfGuest(next);
	const waiting = groupByParty(guests.filter((guest) => !where.has(guest.id)))
		.map((party) => ({ ...party, need: chairsFilled(party.guests.map((g) => g.id), noChair) }))
		.sort((a, b) => b.need - a.need);

	let seated = 0;
	let leftOver = 0;
	for (const party of waiting) {
		const homeIds = new Set(
			guests.filter((g) => g.partyId === party.partyId && where.has(g.id)).map((g) => where.get(g.id)!)
		);
		// A lap baby whose parents are already seated needs no chair: always join them.
		const home = order.find((item) => homeIds.has(item.id) && (party.need === 0 || open(item) >= party.need));
		const target = home ?? order.filter((item) => open(item) >= party.need).sort((a, b) => open(a) - open(b))[0];
		if (!target) {
			leftOver += party.guests.length;
			continue;
		}
		next = seatGuests(next, party.guests.map((g) => g.id), target.id);
		seated += party.guests.length;
	}
	return { tables: next, seated, leftOver };
}

/**
 * A steady hue per party, so one family reads as one colour wherever it sits.
 * Golden-angle steps off a hash keep neighbouring parties apart on the wheel.
 */
export function partyHue(partyId: string): number {
	let hash = 0;
	for (let index = 0; index < partyId.length; index += 1) {
		hash = (hash * 31 + partyId.charCodeAt(index)) >>> 0;
	}
	return Math.round((hash % 360) * 137.508) % 360;
}

/** What a guest typed in the dietary box, unless it amounts to "nothing". */
export function dietaryNote(guest: SeatGuest): string {
	const note = guest.dietary.trim();
	return /^(n\/?a|none|no|nope|nothing|no restrictions?|-+|\.)$/i.test(note) ? '' : note;
}

export function guestLabel(guest: SeatGuest): string {
	return guest.name.trim() || `Guest of ${guest.partyName}`;
}

/* ---- cleaning anything a browser sends ---------------------------------- */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function cleanTables(raw: unknown): Record<string, TableSeating> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const seen = new Set<string>();
	const tables: Record<string, TableSeating> = {};
	for (const [tableId, value] of Object.entries(raw as Record<string, unknown>).slice(0, 200)) {
		if (!ID_PATTERN.test(tableId) || !value || typeof value !== 'object') continue;
		const source = value as Record<string, unknown>;
		const capacity =
			typeof source.capacity === 'number' && Number.isFinite(source.capacity)
				? Math.min(MAX_TABLE_CAPACITY, Math.max(1, Math.round(source.capacity)))
				: null;
		// One chair per guest across the whole chart, including twice at one table.
		const guests: string[] = [];
		for (const id of Array.isArray(source.guests) ? source.guests : []) {
			if (guests.length >= 40) break;
			if (typeof id !== 'string' || !ID_PATTERN.test(id) || seen.has(id)) continue;
			seen.add(id);
			guests.push(id);
		}
		tables[tableId] = {
			name: typeof source.name === 'string' ? source.name.trim().slice(0, 40) : '',
			capacity,
			guests
		};
	}
	return tables;
}

export function cleanNoChair(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return [...new Set(raw.filter((id): id is string => typeof id === 'string' && ID_PATTERN.test(id)))].slice(0, 500);
}

export type ChartRow = {
	id: string;
	name: string;
	plan_id: string;
	tables: unknown;
	no_chair: unknown;
	created_at: string;
	updated_at: string;
};

export const CHART_COLS = 'id, name, plan_id, tables, no_chair, created_at, updated_at';

export function toSeatingChart(row: ChartRow): SeatingChart {
	return {
		id: row.id,
		name: row.name,
		planId: row.plan_id,
		tables: cleanTables(row.tables),
		noChair: cleanNoChair(row.no_chair),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
