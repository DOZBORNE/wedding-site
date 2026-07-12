import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let client: SupabaseClient | undefined;

/** Service-role client — server only. RLS locks these tables to everyone else. */
export function db(): SupabaseClient {
	if (!client) {
		const url = env.SUPABASE_URL;
		const key = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) {
			throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — see .env.example');
		}
		client = createClient(url, key, { auth: { persistSession: false } });
	}
	return client;
}

export const GUEST_COLS = 'id, name, is_plus_one, attending, meal, dietary, sort_order';
