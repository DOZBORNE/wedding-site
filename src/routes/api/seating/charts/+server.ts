import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/supabase';
import { isAdmin } from '$lib/server/admin';
import {
	CHART_COLS,
	cleanNoChair,
	cleanTables,
	toSeatingChart,
	type ChartRow
} from '$lib/pavilion/seating';

const MAX_CHARTS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!UUID.test(id)) return json({ error: 'Which chart?' }, { status: 400 });
	const { data, error } = await db().from('seating_charts').select(CHART_COLS).eq('id', id).maybeSingle();
	if (error) return json({ error: 'Could not load that chart.' }, { status: 500 });
	if (!data) return json({ error: 'That chart has been deleted.' }, { status: 404 });
	return json({ chart: toSeatingChart(data as ChartRow) });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const name = String(body?.name ?? '').trim().slice(0, 60);
	const planId = String(body?.planId ?? '');
	if (!name) return json({ error: 'Give the chart a name first.' }, { status: 400 });
	if (!UUID.test(planId)) return json({ error: 'Pick a layout to seat people on.' }, { status: 400 });

	const { count, error: countError } = await db()
		.from('seating_charts')
		.select('id', { count: 'exact', head: true });
	if (countError) return json({ error: 'Could not create the chart — try again.' }, { status: 500 });
	if ((count ?? 0) >= MAX_CHARTS) {
		return json(
			{ error: `That is ${MAX_CHARTS} charts saved — delete one before adding another.` },
			{ status: 409 }
		);
	}

	const { data, error } = await db()
		.from('seating_charts')
		.insert({
			name,
			plan_id: planId,
			tables: cleanTables(body?.tables),
			no_chair: cleanNoChair(body?.noChair)
		})
		.select(CHART_COLS)
		.single();
	if (error?.code === '23503') {
		return json({ error: 'That layout has been deleted — pick another.' }, { status: 400 });
	}
	if (error || !data) return json({ error: 'Could not create the chart — try again.' }, { status: 500 });
	return json({ chart: toSeatingChart(data as ChartRow) }, { status: 201 });
};

/**
 * Saves only if nobody else has saved since this browser last loaded the chart.
 * Otherwise answers 409 with the newer version so the page can offer to reload.
 */
export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const id = String(body?.id ?? '');
	const updatedAt = String(body?.updatedAt ?? '');
	if (!UUID.test(id) || Number.isNaN(Date.parse(updatedAt))) {
		return json({ error: 'Which chart?' }, { status: 400 });
	}
	// Every save sends the whole chart. Refuse one that doesn't, rather than
	// read a missing field as "unseat everyone".
	const tables = body?.tables;
	if (!tables || typeof tables !== 'object' || Array.isArray(tables) || !Array.isArray(body?.noChair)) {
		return json({ error: 'That save was missing the seating.' }, { status: 400 });
	}

	const patch: Record<string, unknown> = {
		tables: cleanTables(tables),
		no_chair: cleanNoChair(body.noChair),
		updated_at: new Date().toISOString()
	};
	const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : '';
	if (name) patch.name = name;

	const { data, error } = await db()
		.from('seating_charts')
		.update(patch)
		.eq('id', id)
		.eq('updated_at', updatedAt)
		.select(CHART_COLS)
		.maybeSingle();
	if (error) return json({ error: 'Could not save the chart.' }, { status: 500 });
	if (data) return json({ chart: toSeatingChart(data as ChartRow) });

	const { data: current } = await db().from('seating_charts').select(CHART_COLS).eq('id', id).maybeSingle();
	if (!current) return json({ error: 'That chart has been deleted.' }, { status: 404 });
	return json(
		{ error: 'Someone else saved this chart first.', chart: toSeatingChart(current as ChartRow) },
		{ status: 409 }
	);
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
	if (!isAdmin(cookies)) {
		return json({ error: 'Sign in at /admin to delete a chart.' }, { status: 403 });
	}
	const id = url.searchParams.get('id') ?? '';
	if (!UUID.test(id)) return json({ error: 'Which chart?' }, { status: 400 });
	const { error } = await db().from('seating_charts').delete().eq('id', id);
	if (error) return json({ error: 'Could not delete that chart.' }, { status: 500 });
	return json({ ok: true });
};
