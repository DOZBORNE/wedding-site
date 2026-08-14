import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { COUPLE, VENUE, WEDDING } from '$lib/config';
import type { Guest } from '$lib/types';

const names = `${COUPLE.first} & ${COUPLE.partnerFirst}`;

function resend(): Resend | null {
	return env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
}

function shell(inner: string) {
	// A full document with a viewport tag: without it phone clients zoom the
	// 560px card out and the call-to-action ends up a few pixels tall.
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="format-detection" content="telephone=no" />
<style>
	@media only screen and (max-width: 600px) {
		.em-card { padding: 24px 18px !important; }
		.em-btn a { display: block !important; padding: 18px 16px !important; }
	}
</style>
</head>
<body style="margin:0;padding:0;background:#221A14;">
	<div style="background:#221A14;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
		<div class="em-card" style="max-width:560px;margin:0 auto;background:#E8DCC8;color:#3A2420;padding:36px 32px;border:1px solid #4A2E1F;">
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
	</div>
</body>
</html>`;
}

/**
 * The call-to-action. A padded <a> collapses in Gmail's and Outlook's mobile
 * apps, so the colour lives on a table cell and the link fills it — plus the raw
 * URL underneath for any client that mangles the button anyway.
 */
function button(url: string, label: string) {
	return `
			<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 8px;">
				<tr>
					<td class="em-btn" align="center" bgcolor="#381015" style="background:#381015;">
						<a href="${url}" style="display:inline-block;padding:16px 30px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.2;letter-spacing:2px;text-transform:uppercase;color:#E8DCC8;text-decoration:none;">${label}</a>
					</td>
				</tr>
			</table>
			<p style="text-align:center;font-size:12px;color:#4A2E1F;margin:0 0 8px;word-break:break-all;">
				or open <a href="${url}" style="color:#381015;">${url}</a>
			</p>`;
}

/** Resend allows 2 requests a second — one queue keeps a whole batch under it. */
const SEND_GAP_MS = 600;
let nextSlot = 0;
function pace(): Promise<void> {
	const now = Date.now();
	const at = Math.max(now, nextSlot);
	nextSlot = at + SEND_GAP_MS;
	return at > now ? new Promise((r) => setTimeout(r, at - now)) : Promise.resolve();
}

const isRateLimit = (msg: string) => /rate.?limit|too many requests|429/i.test(msg);

/** Returns the Resend message id on success (may be ''), or null if not sent. */
async function send(to: string, subject: string, html: string): Promise<string | null> {
	const r = resend();
	// Not configured (no key / from / recipient) — skip quietly.
	if (!r || !env.RESEND_FROM || !to) return null;

	for (let attempt = 0; ; attempt++) {
		await pace();
		// No replyTo: replies go to RESEND_FROM, which forwards to a real inbox. A
		// Reply-To on a different organisational domain than the From is a phishing
		// tell that spam filters score against us, and it was landing invitations in
		// spam. Keep the two domains identical — route replies with MX, not a header.
		const { data, error } = await r.emails.send({
			from: env.RESEND_FROM,
			to,
			subject,
			html,
			text: htmlToText(html) // plain-text alternative — better deliverability
		});
		if (!error) return data?.id ?? '';
		// Being throttled isn't a rejection — wait out the window and try again.
		// (A dropped send used to leave the party unmarked, so the next run re-invited it.)
		const message = error.message || 'Resend rejected the email';
		if (isRateLimit(message) && attempt < 2) {
			nextSlot = Date.now() + 1200;
			continue;
		}
		// A real rejection (unverified domain, bad address…) — throw so callers can report it.
		throw new Error(message);
	}
}

/** A plain-text version of the HTML — improves deliverability and gives text-only clients a body. */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		// keep link URLs, without repeating one that's already spelled out
		.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
			const label = text.replace(/<[^>]+>/g, '').trim();
			return label && label !== href ? `${label}: ${href}` : href;
		})
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
						${g.attending === true ? 'joyfully accepts' : g.attending === false ? 'regretfully declines' : '—'}
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
			<p style="font-size:14px;font-style:italic;">Need to change something? Just reply to this email,
			or open our site again on this device — your invitation will be right where you left it.</p>
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
			<p style="font-size:15px;">We would be honored to have you with us. The link below opens our
			wedding site — have a look around, and your invitation is waiting for you at the bottom:</p>
			${button(rsvpUrl, 'Open our wedding site')}
			<p style="font-size:14px;font-style:italic;">Kindly reply by ${WEDDING.rsvpDeadlineLabel}.
			Scroll down to the sealed envelope, press the seal, and your invitation opens — no code needed.</p>
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
			${button(rsvpUrl, 'Open our wedding site')}
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
			${button(rsvpUrl, 'View your RSVP')}
		`)
	);
}
