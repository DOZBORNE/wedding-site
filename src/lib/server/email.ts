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

/** Returns the Resend message id on success (may be ''), or null if not sent. */
async function send(to: string, subject: string, html: string): Promise<string | null> {
	const r = resend();
	// Not configured (no key / from / recipient) — skip quietly.
	if (!r || !env.RESEND_FROM || !to) return null;
	const { data, error } = await r.emails.send({
		from: env.RESEND_FROM,
		to,
		subject,
		html,
		text: htmlToText(html), // plain-text alternative — better deliverability
		// Guest replies route here (any inbox; need not be on the verified domain).
		...(env.RESEND_REPLY_TO ? { replyTo: env.RESEND_REPLY_TO } : {})
	});
	// A real rejection (unverified domain, bad address…) — throw so callers can report it.
	if (error) throw new Error(error.message || 'Resend rejected the email');
	return data?.id ?? '';
}

/** A plain-text version of the HTML — improves deliverability and gives text-only clients a body. */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2: $1') // keep link URLs
		.replace(/<\/(p|div|tr|h[1-6]|br)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#?\w+;/g, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.split('\n')
		.map((l) => l.trim())
		.join('\n')
		.trim();
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export async function sendRsvpConfirmation(to: string, partyName: string, guests: Guest[]) {
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
	return send(
		to,
		`Your RSVP is sealed — ${names}, ${WEDDING.dateLabel}`,
		shell(`
			<p style="font-size:16px;">Thank you, <strong>${partyName}</strong> — your reply has been received.</p>
			<table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
			<p style="font-size:14px;font-style:italic;">Need to change something? Just reply to this email or visit the RSVP page again.</p>
		`)
	);
}

export async function sendInvite(to: string, partyName: string, rsvpUrl: string) {
	return send(
		to,
		`You're invited — ${names}, ${WEDDING.dateLabel}`,
		shell(`
			<p style="font-size:16px;">Dear <strong>${partyName}</strong>,</p>
			<p style="font-size:15px;">Together with our families, we joyfully invite you to celebrate our
			marriage at <strong>${VENUE.name}</strong> on <strong>${WEDDING.dateLabel}</strong>.</p>
			<div style="text-align:center;font-size:14px;font-style:italic;color:#4A2E1F;margin:20px 0;">
				Ceremony ${WEDDING.ceremonyTime} · Reception ${WEDDING.receptionTime}<br/>${VENUE.address}
			</div>
			<p style="font-size:15px;">We would be honored to have you with us. Please let us know if you can
			join — it takes less than a minute:</p>
			<div style="text-align:center;margin:24px 0;">
				<a href="${rsvpUrl}" style="background:#381015;color:#E8DCC8;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Break the seal · RSVP</a>
			</div>
			<p style="font-size:14px;font-style:italic;">Kindly reply by ${WEDDING.rsvpDeadlineLabel}.
			The button above opens your invitation directly — no code needed.</p>
		`)
	);
}

export async function sendReminder(to: string, partyName: string, rsvpUrl: string) {
	return send(
		to,
		`A gentle reminder to RSVP — ${names}, ${WEDDING.dateLabel}`,
		shell(`
			<p style="font-size:16px;">Dear <strong>${partyName}</strong>,</p>
			<p style="font-size:15px;">We're so hoping you can join us at ${VENUE.name} on ${WEDDING.dateLabel}.
			We haven't received your reply yet — it takes less than a minute:</p>
			<div style="text-align:center;margin:24px 0;">
				<a href="${rsvpUrl}" style="background:#381015;color:#E8DCC8;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Break the seal · RSVP</a>
			</div>
			<p style="font-size:14px;font-style:italic;">Please reply by ${WEDDING.rsvpDeadlineLabel}.</p>
		`)
	);
}

/** A broadcast update (venue change, logistics, booking news). `message` is plain text. */
export async function sendUpdate(
	to: string,
	partyName: string,
	subject: string,
	message: string,
	rsvpUrl: string
) {
	const paragraphs = message
		.split(/\n{2,}/)
		.map((p) => `<p style="font-size:15px;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
		.join('');
	return send(
		to,
		`${subject} — ${names}`,
		shell(`
			<p style="font-size:16px;">Dear <strong>${partyName}</strong>,</p>
			${paragraphs}
			<div style="text-align:center;margin:24px 0;">
				<a href="${rsvpUrl}" style="background:#381015;color:#E8DCC8;text-decoration:none;padding:12px 28px;font-size:12px;letter-spacing:3px;text-transform:uppercase;">View your RSVP</a>
			</div>
		`)
	);
}
