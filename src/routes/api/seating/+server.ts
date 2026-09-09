import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/supabase';
import { isAdmin } from '$lib/server/admin';
import { countSeats } from '$lib/pavilion/spacing';
import type { PlanItem, SavedPlan, SpacingRule } from '$lib/pavilion/types';

const PLAN_COLS = 'id, name, seats, items, spacing, created_at';
const MAX_PLANS = 40;
const MAX_ITEMS = 400;

/** Anything a browser sends is untrusted — rebuild each item from known fields. */
function cleanItem(raw: unknown): PlanItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const source = raw as Record<string, unknown>;
	const number = (value: unknown, fallback = 0) =>
		typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	const text = (value: unknown, limit: number) =>
		typeof value === 'string' ? value.slice(0, limit) : '';

	const id = text(source.id, 64);
	const key = text(source.key, 40);
	if (!id || !key) return null;

	return {
		id,
		key,
		label: text(source.label, 40) || key,
		shape: source.shape === 'round' ? 'round' : 'rect',
		widthFeet: Math.min(120, Math.max(0.5, number(source.widthFeet, 5))),
		depthFeet: Math.min(120, Math.max(0.5, number(source.depthFeet, 5))),
		seats: Math.min(20, Math.max(0, Math.round(number(source.seats)))),
		chairSide: source.chairSide === 'one' ? 'one' : 'both',
		category:
			source.category === 'serviceTable' ||
			source.category === 'danceFloor' ||
			source.category === 'discJockey' ||
			source.category === 'circulation'
				? source.category
				: 'guestTable',
		x: Math.min(400, Math.max(-400, number(source.x))),
		y: Math.min(400, Math.max(-400, number(source.y))),
		rotationDegrees: ((Math.round(number(source.rotationDegrees)) % 360) + 360) % 360
	};
}

function cleanSpacing(raw: unknown): SpacingRule {
	const source = (raw ?? {}) as Record<string, unknown>;
	const clamp = (value: unknown, low: number, high: number, fallback: number) =>
		typeof value === 'number' && Number.isFinite(value)
			? Math.min(high, Math.max(low, value))
			: fallback;
	return {
		seatedGuestFeet: clamp(source.seatedGuestFeet, 1, 4, 2),
		walkingLaneFeet: clamp(source.walkingLaneFeet, 0.5, 6, 1)
	};
}

type PlanRow = {
	id: string;
	name: string;
	seats: number;
	items: unknown;
	spacing: unknown;
	created_at: string;
};

function toSavedPlan(row: PlanRow): SavedPlan {
	return {
		id: row.id,
		name: row.name,
		seats: row.seats,
		items: Array.isArray(row.items) ? (row.items as PlanItem[]) : [],
		spacing: cleanSpacing(row.spacing),
		createdAt: row.created_at
	};
}

export const GET: RequestHandler = async () => {
	const { data, error } = await db()
		.from('pavilion_plans')
		.select(PLAN_COLS)
		.order('created_at', { ascending: false })
		.limit(MAX_PLANS);
	if (error) return json({ error: 'Could not load the saved plans.' }, { status: 500 });
	return json({ plans: (data ?? []).map((row) => toSavedPlan(row as PlanRow)) });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const name = String(body?.name ?? '').trim().slice(0, 60);
	if (!name) return json({ error: 'Give the plan a name first.' }, { status: 400 });

	const rawItems: unknown[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
	const items = rawItems.map(cleanItem).filter((item): item is PlanItem => item !== null);
	if (!items.length) return json({ error: 'There is nothing on the plan to save.' }, { status: 400 });

	const { count } = await db()
		.from('pavilion_plans')
		.select('id', { count: 'exact', head: true });
	if ((count ?? 0) >= MAX_PLANS) {
		return json(
			{ error: `That is ${MAX_PLANS} plans saved — delete one before adding another.` },
			{ status: 409 }
		);
	}

	const { data, error } = await db()
		.from('pavilion_plans')
		.insert({ name, seats: countSeats(items), items, spacing: cleanSpacing(body?.spacing) })
		.select(PLAN_COLS)
		.single();
	if (error || !data) return json({ error: 'Could not save the plan — try again.' }, { status: 500 });

	return json({ plan: toSavedPlan(data as PlanRow) }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
	if (!isAdmin(cookies)) {
		return json({ error: 'Sign in at /admin to delete a plan.' }, { status: 403 });
	}
	const id = url.searchParams.get('id') ?? '';
	if (!id) return json({ error: 'Which plan?' }, { status: 400 });

	const { error } = await db().from('pavilion_plans').delete().eq('id', id);
	if (error) return json({ error: 'Could not delete that plan.' }, { status: 500 });
	return json({ ok: true });
};
