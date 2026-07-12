import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { sendAllReminders } from '$lib/server/reminders';

/** For an optional cron job. Manual sending lives in /admin. */
export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization');
	if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const result = await sendAllReminders({ includeSms: true });
	return json(result);
};
