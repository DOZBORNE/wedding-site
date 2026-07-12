import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { COUPLE, VENUE, WEDDING } from '$lib/config';
import type { Guest } from '$lib/types';

const names = `${COUPLE.first} & ${COUPLE.partnerFirst}`;

function resend(): Resend | null {
	return env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
}

function shell(inner: string) {
	return `
	<div style="background:#221A14;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
		<div style="max-width:560px;margin:0 auto;background:#E8DCC8;color:#3A2420;padding:36px 32px;border:1px solid #4A2E1F;">
			<div style="text-align:center;font-size:26px;font-style:italic;color:#381015;margin-bottom:4px;">${names}</div>
			<div style="text-align:center;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4A2E1F;margin-bottom:24px;">
				${WEDDING.dateLabel} · ${VENUE.name}
			</div>
			<hr style="border:none;border-top:1px solid #4A2E1F;opacity:0.4;margin:0 0 24px;" />
			${inner}
			<hr style="border:none;border-top:1px solid #4A2E1F;opacity:0.4;margin:24px 0;" />
			<div style="text-align:center;font-size:12px;font-style:italic;color:#4A2E1F;">
				${VENUE.address}<br/>${COUPLE.hashtag}
			</div>
		</div>
	</div>`;
}

export async function sendRsvpConfirmation(to: string, partyName: string, guests: Guest[]) {
	const r = resend();
	if (!r || !env.RESEND_FROM || !to) return;
	const rows = guests
		.map(
			(g) =>
				`<tr>
					<td style="padding:6px 0;">${g.name || 'Guest'}</td>
					<td style="padding:6px 0;text-align:right;font-style:italic;">
						${g.attending === true ? `joyfully accepts${g.meal ? ' · ' + g.meal : ''}` : g.attending === false ? 'regretfully declines' : '—'}
					</td>
				</tr>`
		)
		.join('');
	await r.emails.send({
		from: env.RESEND_FROM,
		to,
		subject: `Your RSVP is sealed — ${names}, ${WEDDING.dateLabel}`,
		html: shell(`
			<p style="font-size:16px;">Thank you, <strong>${partyName}</strong> — your reply has been received.</p>
			<table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
			<p style="font-size:14px;font-style:italic;">Need to change something? Just reply to this email or visit the RSVP page again.</p>
		`)
	});
}

export async function sendReminder(to: string, partyName: string, rsvpUrl: string) {
	const r = resend();
	if (!r || !env.RESEND_FROM || !to) return false;
	await r.emails.send({
		from: env.RESEND_FROM,
		to,
		subject: `A gentle reminder to RSVP — ${names}, ${WEDDING.dateLabel}`,
		html: shell(`
			<p style="font-size:16px;">Dear <strong>${partyName}</strong>,</p>
			<p style="font-size:15px;">We're so hoping you can join us at ${VENUE.name} on ${WEDDING.dateLabel}.
			We haven't received your reply yet — it takes less than a minute:</p>
			<div style="text-align:center;margin:24px 0;">
				<a href="${rsvpUrl}" style="background:#381015;color:#E8DCC8;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Break the seal · RSVP</a>
			</div>
			<p style="font-size:14px;font-style:italic;">Please reply by ${WEDDING.rsvpDeadlineLabel}.</p>
		`)
	});
	return true;
}
