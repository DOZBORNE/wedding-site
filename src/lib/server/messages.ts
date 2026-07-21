import { db } from './supabase';

export type Channel = 'email' | 'sms';
export type MessageKind = 'invite' | 'reminder' | 'update' | 'confirmation';

type LogInput = {
	party_id: string | null;
	guest_id?: string | null;
	channel: Channel;
	kind: MessageKind;
	to_address: string;
	status?: 'sent' | 'failed';
	provider_id?: string;
	body?: string;
};

/** Record an outbound message. Best-effort — never let logging break a send. */
export async function logMessage(m: LogInput) {
	try {
		await db()
			.from('wed_messages')
			.insert({
				party_id: m.party_id,
				guest_id: m.guest_id ?? null,
				channel: m.channel,
				kind: m.kind,
				to_address: m.to_address,
				status: m.status ?? 'sent',
				provider_id: m.provider_id ?? '',
				body: (m.body ?? '').slice(0, 2000)
			});
	} catch {
		/* swallow — the message itself already went out */
	}
}

/** Unique, non-empty, lower-cased recipients (dedupes party + per-guest contacts). */
export function dedupeRecipients(values: (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const v = (raw ?? '').trim();
		if (!v) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
	}
	return out;
}
