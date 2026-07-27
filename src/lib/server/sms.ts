import { env } from '$env/dynamic/private';

export function smsEnabled(): boolean {
	return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

function normalize(phone: string): string {
	const digits = phone.replace(/[^\d+]/g, '');
	if (digits.startsWith('+')) return digits;
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
	return digits;
}

/**
 * Plain fetch to the Twilio REST API — no SDK needed for one endpoint.
 * Returns the Twilio message SID on success (may be ''), or null when SMS is
 * switched off / there's no number to text.
 *
 * A rejected send **throws**. It used to return null, which read to every caller
 * as "nothing to do here" — so a text Twilio refused (unverified number, bad
 * recipient, out of credit) was counted as a non-event: not tallied as a failure,
 * not logged, and no obstacle to stamping the party invited. The batch would then
 * skip that party forever. Failing loudly is what keeps a phone-first send honest.
 */
export async function sendSms(to: string, body: string): Promise<string | null> {
	if (!smsEnabled() || !to) return null;
	const sid = env.TWILIO_ACCOUNT_SID!;
	const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			To: normalize(to),
			From: env.TWILIO_FROM_NUMBER!,
			Body: body
		})
	});

	const data = (await res.json().catch(() => ({}))) as {
		sid?: string;
		message?: string;
		code?: number;
	};

	if (!res.ok) {
		// Twilio's own wording is the useful part — "The 'To' number is unverified",
		// "Account not active" — so carry it up to the admin panel verbatim.
		const detail = data.message || `Twilio returned ${res.status}.`;
		throw new Error(data.code ? `${detail} (Twilio ${data.code})` : detail);
	}
	return data.sid ?? '';
}
