import type { PageServerLoad } from './$types';
import { db } from '$lib/server/supabase';
import { isAdmin } from '$lib/server/admin';
import type { PlanItem, SavedPlan } from '$lib/pavilion/types';
import { DEFAULT_SPACING } from '$lib/pavilion/spacing';

/**
 * The planner is a working tool rather than a guest page: no invite code, no
 * session. Anyone with the link reads and saves; only an admin can delete.
 */
export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });

	const { data, error } = await db()
		.from('pavilion_plans')
		.select('id, name, seats, items, spacing, created_at')
		.order('created_at', { ascending: false })
		.limit(40);

	const plans: SavedPlan[] = error
		? []
		: (data ?? []).map((row) => ({
				id: row.id as string,
				name: row.name as string,
				seats: row.seats as number,
				items: Array.isArray(row.items) ? (row.items as PlanItem[]) : [],
				spacing: { ...DEFAULT_SPACING, ...(row.spacing as object) },
				createdAt: row.created_at as string
			}));

	return { plans, canDelete: isAdmin(cookies), plansUnavailable: Boolean(error) };
};
