import type { PageServerLoad } from './$types';
import { db } from '$lib/server/supabase';
import { isAdmin } from '$lib/server/admin';
import type { PlanItem, SavedPlan, SeatGuest } from '$lib/pavilion/types';
import { DEFAULT_SPACING } from '$lib/pavilion/spacing';
import { CHART_COLS, toSeatingChart, type ChartRow } from '$lib/pavilion/seating';
import { toAgeGroup } from '$lib/types';

/**
 * The planner is a working tool rather than a guest page: no invite code, no
 * session. Anyone with the link reads and saves; only an admin can delete.
 * The seating side sends guest names and dietary notes only — never contact
 * details — and only for people who are coming, or who a chart still seats.
 */
export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });

	const [plansRes, chartsRes, guestsRes] = await Promise.all([
		db()
			.from('pavilion_plans')
			.select('id, name, seats, items, spacing, created_at')
			.order('created_at', { ascending: false })
			.limit(40),
		db().from('seating_charts').select(CHART_COLS).order('created_at', { ascending: false }).limit(40),
		db()
			.from('wed_guests')
			.select('id, party_id, name, attending, dietary, age_group, sort_order, wed_parties ( display_name )')
	]);

	const plans: SavedPlan[] = plansRes.error
		? []
		: (plansRes.data ?? []).map((row) => ({
				id: row.id as string,
				name: row.name as string,
				seats: row.seats as number,
				items: Array.isArray(row.items) ? (row.items as PlanItem[]) : [],
				spacing: { ...DEFAULT_SPACING, ...(row.spacing as object) },
				createdAt: row.created_at as string
			}));

	const charts = chartsRes.error ? [] : (chartsRes.data ?? []).map((row) => toSeatingChart(row as ChartRow));

	const seatedSomewhere = new Set(
		charts.flatMap((chart) => Object.values(chart.tables).flatMap((table) => table.guests))
	);
	const guests: SeatGuest[] = (guestsRes.data ?? [])
		.filter((row) => row.attending === true || seatedSomewhere.has(row.id as string))
		.map((row) => {
			const party = row.wed_parties as unknown as { display_name: string } | null;
			return {
				id: row.id as string,
				partyId: row.party_id as string,
				partyName: party?.display_name ?? '',
				name: (row.name as string) ?? '',
				ageGroup: toAgeGroup(row.age_group),
				dietary: (row.dietary as string) ?? '',
				attending: row.attending as boolean | null,
				sortOrder: (row.sort_order as number) ?? 0
			};
		});

	return {
		plans,
		charts,
		guests,
		canDelete: isAdmin(cookies),
		plansUnavailable: Boolean(plansRes.error),
		chartsUnavailable: Boolean(chartsRes.error),
		guestsUnavailable: Boolean(guestsRes.error)
	};
};
