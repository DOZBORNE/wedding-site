import { placeItem } from './catalog';
import type { PlanItem } from './types';

/**
 * Starting layouts. Every table clears the default rule (24″ seated guest,
 * 12″ lane — 10 ft centres for a 60″ round) against its neighbours, the
 * pavilion columns and the marked zones, so none of these opens pre-flagged.
 * Loosening the rule to Standard or Comfortable will flag the tighter two, which
 * is the point: it shows what the extra elbow room costs in seats.
 */
export interface Preset {
	key: string;
	name: string;
	blurb: string;
	build: () => PlanItem[];
}

const roundsAt = (y: number, positions: number[]): PlanItem[] =>
	positions.map((x) => placeItem('round60', x, y));

/** Two 6′ tables in the amphitheater apron, nearest the kitchen. */
const cateringPair = (): PlanItem[] => [
	placeItem('catering6', 10, -7),
	placeItem('catering6', 18, -7)
];

export const PRESETS: Preset[] = [
	{
		key: 'centreAisle',
		name: 'Aisle down the middle',
		blurb:
			'Dance floor takes the first 20 ft, DJ just outside on the sound jack. Two ranks of five either side of a clear 5 ft aisle.',
		build: () => [
			placeItem('danceFloor', 10, 21, { widthFeet: 20, depthFeet: 16 }),
			placeItem('discJockey', 9, 43.5),
			placeItem('aisle', 35.5, 20, { widthFeet: 29, depthFeet: 5 }),
			placeItem('sweetheart', 54, 20, { rotationDegrees: 90 }),
			...cateringPair(),
			...roundsAt(8, [6.8, 18.4, 30, 41.6, 53.2]),
			...roundsAt(33.5, [6.8, 18.4, 30, 41.6, 53.2])
		]
	},
	{
		key: 'kitchenSideAisle',
		name: 'Aisle on the kitchen side',
		blurb:
			'The lane hugs the kitchen and amphitheater edge so servers never cross the room. Three ranks below it, two more tucked past the dance floor.',
		build: () => [
			placeItem('danceFloor', 10, 20, { widthFeet: 20, depthFeet: 18 }),
			placeItem('discJockey', 9, 43.5),
			placeItem('aisle', 40, 2.5, { widthFeet: 38, depthFeet: 5 }),
			placeItem('sweetheart', 6.8, 6),
			...cateringPair(),
			...roundsAt(10, [30, 41.6, 53.2]),
			...roundsAt(20, [30, 41.6, 53.2]),
			...roundsAt(30, [30, 41.6, 53.2]),
			...roundsAt(34, [6.8, 18.4])
		]
	},
	{
		key: 'everySeat',
		name: 'Every seat we can get',
		blurb:
			'Dance floor trimmed to 15 × 16 and everything on a 10 ft grid — the most the pavilion holds. Four more on the patio behind a walkway.',
		build: () => [
			placeItem('danceFloor', 7.5, 20, { widthFeet: 15, depthFeet: 16 }),
			placeItem('discJockey', 7, 43.5),
			placeItem('walkway', 62, 20, { widthFeet: 4, depthFeet: 40 }),
			...cateringPair(),
			...roundsAt(5, [6.8, 18.4, 30, 41.6, 53.2]),
			...roundsAt(15, [20.5, 30.5, 40.5, 50.5]),
			...roundsAt(25, [20.5, 30.5, 40.5, 50.5]),
			...roundsAt(35, [6.8, 18.4, 30, 41.6, 53.2]),
			...roundsAt(5, [70.5]),
			...roundsAt(15, [70.5]),
			...roundsAt(25, [70.5]),
			...roundsAt(35, [70.5])
		]
	}
];
