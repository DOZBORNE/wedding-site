export type ItemShape = 'round' | 'rect';

export type ItemCategory =
	| 'guestTable'
	| 'serviceTable'
	| 'danceFloor'
	| 'discJockey'
	| 'circulation';

/** Which sides of a rectangular table carry chairs. Sweetheart tables seat one side. */
export type ChairSide = 'both' | 'one';

/**
 * One movable thing on the plan. `x`/`y` are the centre in feet, measured from
 * the pavilion's inside corner nearest the kitchen. Rounds use `widthFeet` as
 * their diameter and ignore `depthFeet`.
 */
export interface PlanItem {
	id: string;
	key: string;
	label: string;
	shape: ItemShape;
	widthFeet: number;
	depthFeet: number;
	seats: number;
	chairSide: ChairSide;
	category: ItemCategory;
	x: number;
	y: number;
	rotationDegrees: number;
}

/**
 * How much floor a seated guest and a walking lane need. Each table claims half
 * the lane, so two neighbours together reserve the whole of it exactly once.
 */
export interface SpacingRule {
	seatedGuestFeet: number;
	walkingLaneFeet: number;
}

export interface SavedPlan {
	id: string;
	name: string;
	seats: number;
	items: PlanItem[];
	spacing: SpacingRule;
	createdAt: string;
}

export interface ConflictNotice {
	locator: string;
	message: string;
}

export interface PinchLine {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	caption: string;
}

export interface ConflictReport {
	flaggedIds: Set<string>;
	notices: ConflictNotice[];
	pinchLines: PinchLine[];
}
