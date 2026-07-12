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

/** Plain fetch to the Twilio REST API — no SDK needed for one endpoint. */
export async function sendSms(to: string, body: string): Promise<boolean> {
	if (!smsEnabled() || !to) return false;
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
	return res.ok;
}
