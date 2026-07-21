<script lang="ts">
	import { COUPLE, VENUE, WEDDING } from '$lib/config';
	import Icon from '$lib/components/Icon.svelte';

	const PRIVACY_URL = 'https://osbornex.com/privacy.html';
	// The verified business behind this messaging program (Toll-Free Verification / Trust Hub).
	const BUSINESS = 'Osborne X';
	const BUSINESS_URL = 'https://osbornex.com';
</script>

<svelte:head>
	<title>SMS Terms &amp; Consent — {COUPLE.first} &amp; {COUPLE.partnerFirst}</title>
	<meta name="robots" content="noindex" />
	<meta
		name="description"
		content="How text messaging works for {COUPLE.first} & {COUPLE.partnerFirst}'s wedding: what we send, how often, and how to get help or opt out."
	/>
</svelte:head>

<main class="legal">
	<div class="wrap">
		<div class="head">
			<div class="eyebrow">Text messaging terms &amp; consent</div>
			<h1>{COUPLE.first} <span class="amp">&amp;</span> {COUPLE.partnerFirst}</h1>
			<div class="ornament"><span>❦</span></div>
			<p class="sub">
				How the text messages for our wedding work — what we send, how often, and how to get help
				or stop them at any time.
			</p>
		</div>

		<article class="body">
			<section>
				<h2>Who we are</h2>
				<p>
					These messages are sent for the private wedding of {COUPLE.first} {COUPLE.last} and {COUPLE.partnerFirst}
					{COUPLE.partnerLast}, hosted at
					<a href="/">jesslovesdev.com</a>. The messaging program is operated by Devin Osborne (trade
					name <a href={BUSINESS_URL} rel="noopener">{BUSINESS}</a>).
				</p>
			</section>

			<section>
				<h2>The service &amp; what we send</h2>
				<p>
					We send text messages only to guests we have personally invited to our wedding. Messages
					relate solely to the event and include:
				</p>
				<ul>
					<li><strong>RSVP invitations</strong> — a link to reply on our wedding website.</li>
					<li><strong>RSVP reminders</strong> — a gentle nudge if we haven't heard back yet.</li>
					<li>
						<strong>Event updates</strong> — venue, schedule, travel, and logistics as the day
						approaches.
					</li>
				</ul>
				<p>
					Every message links to your RSVP page on jesslovesdev.com. A typical message reads:
				</p>
				<blockquote>
					You're invited! {COUPLE.first} &amp; {COUPLE.partnerFirst} are getting married {WEDDING.dateLabel}
					at {VENUE.name}. Please RSVP: https://jesslovesdev.com/rsvp?code=ABC123 (Reply STOP to opt
					out)
				</blockquote>
			</section>

			<section>
				<h2>How you opted in</h2>
				<p>
					This is a private, invitation-only program. You gave us your mobile number directly — in
					person, by text, or by phone — when you shared it so we could reach you about the wedding.
					We never buy, rent, or share contact lists, and only people we personally invited receive
					messages.
				</p>
			</section>

			<section>
				<h2>Message frequency</h2>
				<p>
					Message frequency varies, but is low — typically a handful of messages in total across the
					lead-up to the wedding (roughly one to four per month at most).
				</p>
			</section>

			<section>
				<h2>Cost</h2>
				<p>Message and data rates may apply, depending on your mobile carrier and plan.</p>
			</section>

			<section>
				<h2>Getting help</h2>
				<p>
					Reply <strong>HELP</strong> to any message for assistance. You can also reach us using the
					contact details in our
					<a href={PRIVACY_URL} rel="noopener">privacy policy</a>.
				</p>
			</section>

			<section>
				<h2>Opting out</h2>
				<p>
					Reply <strong>STOP</strong> to any message at any time to stop receiving texts. You'll get
					a single confirmation, and we won't text you again. You can still RSVP and read everything
					on our website.
				</p>
			</section>

			<section>
				<h2>Privacy</h2>
				<p>
					We do not sell or share your phone number or SMS opt-in data with any third parties for
					marketing purposes. For full details, see our
					<a href={PRIVACY_URL} rel="noopener">privacy policy</a>.
				</p>
			</section>
		</article>

		<a class="back" href="/"><Icon name="left" /> back to the wedding site</a>
	</div>
</main>

<style>
	.legal {
		min-height: 80vh;
		padding: clamp(2.5rem, 7vw, 5rem) 0 5rem;
		background:
			radial-gradient(ellipse 60% 45% at 50% 0%, rgba(201, 159, 148, 0.1), transparent 70%),
			linear-gradient(180deg, #2a1418 0%, var(--espresso) 55%);
	}
	.wrap {
		max-width: 720px;
	}
	.head {
		text-align: center;
		display: grid;
		gap: 0.7rem;
		justify-items: center;
		margin-bottom: clamp(2rem, 6vw, 3.5rem);
	}
	h1 {
		font-size: clamp(2rem, 6vw, 3rem);
		color: var(--parchment);
	}
	.amp {
		font-style: italic;
		color: var(--blush);
	}
	.sub {
		max-width: 52ch;
		margin: 0.4rem auto 0;
		color: var(--ink-muted);
		font-style: italic;
		font-size: 1.1rem;
	}
	.body {
		display: grid;
		gap: 2.2rem;
	}
	.body h2 {
		font-size: 1.4rem;
		color: var(--parchment);
		margin-bottom: 0.5rem;
	}
	.body p {
		margin: 0 0 0.6rem;
		color: var(--ink-on-dark);
	}
	.body ul {
		margin: 0 0 0.6rem;
		padding-left: 1.3rem;
		display: grid;
		gap: 0.4rem;
		color: var(--ink-on-dark);
	}
	.body a {
		color: var(--candle);
		text-underline-offset: 3px;
	}
	blockquote {
		margin: 0.8rem 0 0;
		padding: 1rem 1.2rem;
		border-left: 2px solid var(--mauve);
		background: rgba(230, 217, 198, 0.04);
		color: var(--ink-muted);
		font-style: italic;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 3rem;
		color: var(--ink-faint);
		font-size: 0.95rem;
		text-decoration: none;
		font-style: italic;
	}
	.back:hover {
		color: var(--candle);
	}
</style>
