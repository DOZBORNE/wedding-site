import { isBlockingZone, isSeating } from './catalog';
import { COLUMN_SIZE_FEET, columnPosts } from './venue';
import type { ConflictReport, PinchLine, PlanItem, SpacingRule } from './types';

/**
 * Banquet practice, and the whole basis of this tool:
 *
 *   · a chair with someone in it reaches ~24″ back from the table edge
 *   · two seated guests need a clear lane between their backs — 12″ is the
 *     squeeze most venues actually set, 36″ walks comfortably, 48–60″ where
 *     servers work
 *
 * Two tables therefore need `guest + guest + lane` of clear floor between their
 * tops, which for 60″ rounds is the familiar 10-to-12 ft centre-to-centre rule.
 * Each table draws only HALF the lane, so rings that touch sit exactly on the
 * rule and only overlapping rings are too tight.
 */
export const DEFAULT_SPACING: SpacingRule = { seatedGuestFeet: 2, walkingLaneFeet: 1 };

/** Named settings, quoted the way a venue quotes them: centres for a 60″ round. */
export const LANE_PRESETS = [
	{ label: 'Tight', centresFeet: 10 },
	{ label: 'Standard', centresFeet: 11 },
	{ label: 'Comfortable', centresFeet: 12 }
] as const;

/** A 60″ round is the reference the presets are quoted against. */
export const REFERENCE_ROUND_FEET = 5;

/** Floating-point slack, so a table sitting exactly on the rule reads as clean. */
const TOLERANCE_FEET = 0.02;

export function centresForRule(spacing: SpacingRule): number {
	return REFERENCE_ROUND_FEET + 2 * spacing.seatedGuestFeet + spacing.walkingLaneFeet;
}

export function laneForCentres(centresFeet: number, seatedGuestFeet: number): number {
	const lane = centresFeet - REFERENCE_ROUND_FEET - 2 * seatedGuestFeet;
	return Math.max(1, Math.min(5, lane));
}

export function seatedGuestReach(item: PlanItem, spacing: SpacingRule): number {
	return item.seats > 0 ? spacing.seatedGuestFeet : 0;
}

/** Half the lane, because the neighbour draws the other half. */
export function laneShare(spacing: SpacingRule): number {
	return spacing.walkingLaneFeet / 2;
}

export interface Point {
	x: number;
	y: number;
}

export interface Bounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export function boundsOf(item: PlanItem): Bounds {
	return {
		left: item.x - item.widthFeet / 2,
		right: item.x + item.widthFeet / 2,
		top: item.y - item.depthFeet / 2,
		bottom: item.y + item.depthFeet / 2
	};
}

function boundsCorners(bounds: Bounds): Point[] {
	return [
		{ x: bounds.left, y: bounds.top },
		{ x: bounds.right, y: bounds.top },
		{ x: bounds.right, y: bounds.bottom },
		{ x: bounds.left, y: bounds.bottom }
	];
}

export function cornersOf(item: PlanItem): Point[] {
	const radians = (item.rotationDegrees * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const halfWidth = item.widthFeet / 2;
	const halfDepth = item.depthFeet / 2;
	return (
		[
			[-halfWidth, -halfDepth],
			[halfWidth, -halfDepth],
			[halfWidth, halfDepth],
			[-halfWidth, halfDepth]
		] as const
	).map(([alongWidth, alongDepth]) => ({
		x: item.x + alongWidth * cosine - alongDepth * sine,
		y: item.y + alongWidth * sine + alongDepth * cosine
	}));
}

/** Distance from a point to a convex polygon; zero when the point is inside. */
function pointToPolygon(pointX: number, pointY: number, corners: Point[]): number {
	let inside = true;
	let shortest = Infinity;
	for (let index = 0; index < corners.length; index += 1) {
		const start = corners[index];
		const end = corners[(index + 1) % corners.length];
		const edgeX = end.x - start.x;
		const edgeY = end.y - start.y;
		if (edgeX * (pointY - start.y) - edgeY * (pointX - start.x) < 0) inside = false;
		const lengthSquared = edgeX * edgeX + edgeY * edgeY;
		const along =
			lengthSquared === 0
				? 0
				: Math.max(
						0,
						Math.min(1, ((pointX - start.x) * edgeX + (pointY - start.y) * edgeY) / lengthSquared)
					);
		shortest = Math.min(
			shortest,
			Math.hypot(pointX - (start.x + along * edgeX), pointY - (start.y + along * edgeY))
		);
	}
	return inside ? 0 : shortest;
}

/**
 * Separating-axis gap between two oriented boxes; negative where they overlap.
 * Exact when the boxes share an axis, and close enough at other angles for a
 * planning drawing.
 */
function polygonGap(first: Point[], second: Point[]): number {
	const axes: Point[] = [];
	for (const corners of [first, second]) {
		for (let index = 0; index < 2; index += 1) {
			const edgeX = corners[index + 1].x - corners[index].x;
			const edgeY = corners[index + 1].y - corners[index].y;
			const length = Math.hypot(edgeX, edgeY) || 1;
			axes.push({ x: edgeX / length, y: edgeY / length });
		}
	}

	let widest = -Infinity;
	for (const axis of axes) {
		const project = (corners: Point[]) => {
			let lowest = Infinity;
			let highest = -Infinity;
			for (const corner of corners) {
				const value = corner.x * axis.x + corner.y * axis.y;
				lowest = Math.min(lowest, value);
				highest = Math.max(highest, value);
			}
			return { lowest, highest };
		};
		const a = project(first);
		const b = project(second);
		widest = Math.max(widest, Math.max(a.lowest - b.highest, b.lowest - a.highest));
	}
	return widest;
}

/** Clear floor between two table tops, ignoring chairs. */
export function gapBetween(first: PlanItem, second: PlanItem): number {
	if (first.shape === 'round' && second.shape === 'round') {
		return (
			Math.hypot(first.x - second.x, first.y - second.y) - first.widthFeet / 2 - second.widthFeet / 2
		);
	}
	if (first.shape === 'round') {
		return pointToPolygon(first.x, first.y, cornersOf(second)) - first.widthFeet / 2;
	}
	if (second.shape === 'round') {
		return pointToPolygon(second.x, second.y, cornersOf(first)) - second.widthFeet / 2;
	}
	return polygonGap(cornersOf(first), cornersOf(second));
}

export function gapToBounds(item: PlanItem, bounds: Bounds): number {
	const corners = boundsCorners(bounds);
	if (item.shape === 'round') {
		return pointToPolygon(item.x, item.y, corners) - item.widthFeet / 2;
	}
	return polygonGap(cornersOf(item), corners);
}

export function formatInches(feet: number): string {
	return `${Math.round(feet * 12)}″`;
}

/** How much table edge each guest gets — the honest read on nine to a 60″ round. */
export function seatWidthInches(item: PlanItem): number {
	if (!item.seats) return 0;
	const edge =
		item.shape === 'round'
			? Math.PI * item.widthFeet
			: item.chairSide === 'one'
				? item.widthFeet
				: item.widthFeet * 2;
	return Math.round((edge / item.seats) * 12);
}

function locatorFor(item: PlanItem): string {
	return `${item.label} @ ${Math.round(item.x)}′,${Math.round(item.y)}′`;
}

/** Everything on the plan that is too tight, and by how much. */
export function findConflicts(items: PlanItem[], spacing: SpacingRule): ConflictReport {
	const flaggedIds = new Set<string>();
	const notices: ConflictReport['notices'] = [];
	const pinchLines: PinchLine[] = [];

	const flag = (item: PlanItem, message: string) => {
		flaggedIds.add(item.id);
		notices.push({ locator: locatorFor(item), message });
	};

	const seating = items.filter(isSeating);

	for (let a = 0; a < seating.length; a += 1) {
		for (let b = a + 1; b < seating.length; b += 1) {
			const first = seating[a];
			const second = seating[b];
			// Service furniture with nobody seated at it may butt together.
			if (!first.seats && !second.seats) continue;

			const needed =
				seatedGuestReach(first, spacing) +
				seatedGuestReach(second, spacing) +
				spacing.walkingLaneFeet;
			const actual = gapBetween(first, second);
			if (actual >= needed - TOLERANCE_FEET) continue;

			flaggedIds.add(first.id);
			flaggedIds.add(second.id);
			notices.push({
				locator: `${locatorFor(first)}  ↔  ${locatorFor(second)}`,
				message: `Only ${formatInches(Math.max(0, actual))} of floor where ${formatInches(needed)} is needed — ${formatInches(needed - actual)} short.`
			});
			pinchLines.push({
				fromX: first.x,
				fromY: first.y,
				toX: second.x,
				toY: second.y,
				caption: `${formatInches(needed - actual)} short`
			});
		}
	}

	const posts = columnPosts();
	for (const item of seating) {
		const needed = seatedGuestReach(item, spacing);
		const onAPost = posts.some(
			(post) =>
				gapToBounds(item, {
					left: post.x - COLUMN_SIZE_FEET / 2,
					right: post.x + COLUMN_SIZE_FEET / 2,
					top: post.y - COLUMN_SIZE_FEET / 2,
					bottom: post.y + COLUMN_SIZE_FEET / 2
				}) <
				needed - TOLERANCE_FEET
		);
		if (onAPost) flag(item, "A guest's chair lands on a pavilion column.");
	}

	const blockers = items.filter(isBlockingZone);
	for (const item of seating) {
		for (const zone of blockers) {
			if (gapToBounds(item, boundsOf(zone)) < seatedGuestReach(item, spacing) - TOLERANCE_FEET) {
				flag(item, `Chairs push into the ${zone.label.toLowerCase()}.`);
			}
		}
	}

	return { flaggedIds, notices, pinchLines };
}

export function countSeats(items: PlanItem[]): number {
	return items.reduce(
		(total, item) => total + (item.category === 'guestTable' ? item.seats : 0),
		0
	);
}
