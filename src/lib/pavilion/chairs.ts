import type { PlanItem } from './types';

/** A folding chair's seat pan, near enough: 18″ square. */
export const CHAIR_WIDTH_FEET = 1.5;
export const CHAIR_DEPTH_FEET = 1.5;

/** How far a tucked-in chair slides under the table top. */
const CHAIR_TUCK_FEET = 0.45;

export interface ChairPlacement {
	x: number;
	y: number;
	rotation: number;
}

/** Chairs pushed in, drawn in the table's own frame. */
export function chairPlacements(item: PlanItem): ChairPlacement[] {
	if (!item.seats) return [];

	if (item.shape === 'round') {
		const ring = item.widthFeet / 2 + CHAIR_DEPTH_FEET / 2 - CHAIR_TUCK_FEET;
		return Array.from({ length: item.seats }, (_unused, index) => {
			const angle = (index / item.seats) * Math.PI * 2 - Math.PI / 2;
			return {
				x: Math.cos(angle) * ring,
				y: Math.sin(angle) * ring,
				rotation: (angle * 180) / Math.PI + 90
			};
		});
	}

	const sides = item.chairSide === 'one' ? [1] : [-1, 1];
	const placements: ChairPlacement[] = [];
	let remaining = item.seats;
	for (const side of sides) {
		const count = Math.min(Math.ceil(item.seats / sides.length), remaining);
		remaining -= count;
		for (let index = 0; index < count; index += 1) {
			placements.push({
				x: ((index + 0.5) / count - 0.5) * item.widthFeet,
				y: side * (item.depthFeet / 2 + CHAIR_DEPTH_FEET / 2 - CHAIR_TUCK_FEET),
				rotation: side === 1 ? 0 : 180
			});
		}
	}
	return placements;
}
