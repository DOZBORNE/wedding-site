/**
 * Aldridge Gardens pavilion and patio, from the venue's 2020 layout drawing.
 * Every measurement is in feet from the pavilion's inside corner nearest the
 * kitchen, x running along the 60 ft side and y along the 40 ft side.
 */

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	depth: number;
}

/** 2,425 sq ft on the drawing; 60 x 40 to the column line. */
export const PAVILION: Rectangle = { x: 0, y: 0, width: 60, depth: 40 };

/** 680 sq ft, hard against the pavilion's far side. */
export const PATIO: Rectangle = { x: 60, y: 0, width: 17, depth: 40 };

export const COLUMN_POSITIONS_ACROSS = [1, 12.6, 24.2, 35.8, 47.4, 59];
export const COLUMN_POSITIONS_DOWN = [1, 10.75, 20.5, 30.25, 39];
export const COLUMN_SIZE_FEET = 1.2;

/** Power outlets marked on the drawing. */
export const OUTLETS: ReadonlyArray<readonly [number, number]> = [
	[16, 1],
	[50, 1],
	[58.5, 3],
	[58.5, 14],
	[16, 39],
	[50, 39]
];

/** Sound jacks — the DJ wants to be near one. */
export const SOUND_JACKS: ReadonlyArray<readonly [number, number]> = [
	[57, 1],
	[10, 39]
];

export interface ColumnPost {
	x: number;
	y: number;
}

let cachedPosts: ColumnPost[] | undefined;

/** The pavilion's columns sit on the perimeter only; the field is clear. */
export function columnPosts(): ColumnPost[] {
	if (cachedPosts) return cachedPosts;
	const seen = new Set<string>();
	const posts: ColumnPost[] = [];
	const add = (x: number, y: number) => {
		const stamp = `${x}:${y}`;
		if (seen.has(stamp)) return;
		seen.add(stamp);
		posts.push({ x, y });
	};
	const firstDown = COLUMN_POSITIONS_DOWN[0];
	const lastDown = COLUMN_POSITIONS_DOWN[COLUMN_POSITIONS_DOWN.length - 1];
	const firstAcross = COLUMN_POSITIONS_ACROSS[0];
	const lastAcross = COLUMN_POSITIONS_ACROSS[COLUMN_POSITIONS_ACROSS.length - 1];
	for (const x of COLUMN_POSITIONS_ACROSS) {
		add(x, firstDown);
		add(x, lastDown);
	}
	for (const y of COLUMN_POSITIONS_DOWN) {
		add(firstAcross, y);
		add(lastAcross, y);
	}
	cachedPosts = posts;
	return posts;
}

export type Surface = 'pavilion' | 'patio' | 'grounds';

export function surfaceAt(x: number, y: number): Surface {
	if (x >= 0 && x <= 60 && y >= 0 && y <= 40) return 'pavilion';
	if (x >= 60 && x <= 77 && y >= 0 && y <= 40) return 'patio';
	return 'grounds';
}
