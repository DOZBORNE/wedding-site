import type { ChairSide, ItemCategory, ItemShape, PlanItem } from './types';

export interface CatalogEntry {
	key: string;
	label: string;
	shape: ItemShape;
	widthFeet: number;
	depthFeet: number;
	seats: number;
	chairSide?: ChairSide;
	category: ItemCategory;
}

/** Rental sizes, with the seat counts a caterer would quote for them. */
export const TABLE_CATALOG: CatalogEntry[] = [
	{ key: 'round60', label: '60″ round', shape: 'round', widthFeet: 5, depthFeet: 5, seats: 9, category: 'guestTable' },
	{ key: 'round72', label: '72″ round', shape: 'round', widthFeet: 6, depthFeet: 6, seats: 10, category: 'guestTable' },
	{ key: 'banquet8', label: '8′ banquet', shape: 'rect', widthFeet: 8, depthFeet: 2.5, seats: 8, category: 'guestTable' },
	{ key: 'banquet6', label: '6′ banquet', shape: 'rect', widthFeet: 6, depthFeet: 2.5, seats: 6, category: 'guestTable' },
	{ key: 'sweetheart', label: 'Sweetheart', shape: 'rect', widthFeet: 4, depthFeet: 2.5, seats: 2, chairSide: 'one', category: 'guestTable' },
	{ key: 'cocktail', label: 'Cocktail', shape: 'round', widthFeet: 2.7, depthFeet: 2.7, seats: 0, category: 'guestTable' },
	{ key: 'catering6', label: '6′ catering', shape: 'rect', widthFeet: 6, depthFeet: 2.5, seats: 0, category: 'serviceTable' },
	{ key: 'cake', label: 'Cake / gift', shape: 'round', widthFeet: 4, depthFeet: 4, seats: 0, category: 'serviceTable' }
];

export const ZONE_CATALOG: CatalogEntry[] = [
	{ key: 'danceFloor', label: 'Dance floor', shape: 'rect', widthFeet: 20, depthFeet: 16, seats: 0, category: 'danceFloor' },
	{ key: 'discJockey', label: 'DJ', shape: 'rect', widthFeet: 8, depthFeet: 5, seats: 0, category: 'discJockey' },
	{ key: 'aisle', label: 'Aisle', shape: 'rect', widthFeet: 29, depthFeet: 5, seats: 0, category: 'circulation' },
	{ key: 'walkway', label: 'Walkway', shape: 'rect', widthFeet: 4, depthFeet: 40, seats: 0, category: 'circulation' }
];

const BY_KEY = new Map<string, CatalogEntry>(
	[...TABLE_CATALOG, ...ZONE_CATALOG].map((entry) => [entry.key, entry])
);

export function catalogEntry(key: string): CatalogEntry | undefined {
	return BY_KEY.get(key);
}

/** Zones mark out floor rather than seating anybody. */
const ZONE_CATEGORIES: ReadonlySet<ItemCategory> = new Set<ItemCategory>([
	'danceFloor',
	'discJockey',
	'circulation'
]);

/** Zones a seated guest's chair must not push into. The DJ can be crowded. */
const BLOCKING_CATEGORIES: ReadonlySet<ItemCategory> = new Set<ItemCategory>([
	'danceFloor',
	'circulation'
]);

export function isZone(item: Pick<PlanItem, 'category'>): boolean {
	return ZONE_CATEGORIES.has(item.category);
}

export function isSeating(item: Pick<PlanItem, 'category'>): boolean {
	return !isZone(item);
}

export function isBlockingZone(item: Pick<PlanItem, 'category'>): boolean {
	return BLOCKING_CATEGORIES.has(item.category);
}

let sequence = 0;

export function nextItemId(): string {
	sequence += 1;
	return `item-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

/** Build a plan item from the catalog, overriding whatever the caller needs. */
export function placeItem(key: string, x: number, y: number, overrides: Partial<PlanItem> = {}): PlanItem {
	const entry = catalogEntry(key);
	if (!entry) throw new Error(`Unknown catalog key: ${key}`);
	return {
		id: nextItemId(),
		key: entry.key,
		label: entry.label,
		shape: entry.shape,
		widthFeet: entry.widthFeet,
		depthFeet: entry.depthFeet,
		seats: entry.seats,
		chairSide: entry.chairSide ?? 'both',
		category: entry.category,
		x,
		y,
		rotationDegrees: 0,
		...overrides
	};
}
