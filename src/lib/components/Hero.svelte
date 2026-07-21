<script lang="ts">
	import { COUPLE, HERO_PHOTO, REGISTRY_URL, VENUE, WEDDING } from '$lib/config';
	import { flankIvy } from '$lib/ivy';
	import Column from './Column.svelte';
	import Icon from './Icon.svelte';

	const target = new Date(WEDDING.dateISO).getTime();
	let daysLeft = $state(Math.max(0, Math.ceil((target - Date.now()) / 86_400_000)));
	$effect(() => {
		const t = setInterval(
			() => (daysLeft = Math.max(0, Math.ceil((target - Date.now()) / 86_400_000))),
			60_000
		);
		return () => clearInterval(t);
	});
</script>

<header class="hero" id="top">
	<div class="hero-inner">
		<div class="eyebrow blush">Together with their families</div>

		<div class="hero-comp" use:flankIvy={{ seed: 1, crown: true, delay: 1000 }}>
			<Column class="hero-col" />
			<div class="hero-arch arch" class:has-photo={!!HERO_PHOTO}>
				{#if HERO_PHOTO}
					<img src={HERO_PHOTO} alt="{COUPLE.first} and {COUPLE.partnerFirst}" />
					<div class="duotone" aria-hidden="true"></div>
				{:else}
					<div class="monogram">
						{COUPLE.monogram[0]}<i>&amp;</i>{COUPLE.monogram[1]}
					</div>
					<div class="photo-note">engagement photo · coming soon</div>
				{/if}
			</div>
			<Column class="hero-col" />
		</div>

		<h1>{COUPLE.first} <span class="amp">&amp;</span> {COUPLE.partnerFirst}</h1>
		<div class="ornament"><span>❦</span></div>
		<div class="date">{WEDDING.dateShort}</div>
		<div class="place">{VENUE.name} — {VENUE.shortAddress}</div>
		{#if daysLeft > 0}
			<div class="count"><i>{daysLeft} days to go</i></div>
		{/if}
		<div class="quick">
			<a class="quick-rsvp" href="/#rsvp">RSVP</a>
			<a class="quick-reg" href={REGISTRY_URL} target="_blank" rel="noopener">
				Registry <Icon name="out" />
			</a>
		</div>
	</div>
</header>

<style>
	.hero {
		position: relative;
		min-height: 92vh;
		min-height: 92svh;
		display: grid;
		place-items: center;
		text-align: center;
		background:
			radial-gradient(ellipse 60% 45% at 50% 30%, rgba(201, 159, 148, 0.14), transparent 70%),
			radial-gradient(ellipse 80% 60% at 50% 100%, rgba(56, 16, 21, 0.9), transparent),
			linear-gradient(180deg, #2a1418 0%, var(--claret) 55%, #2b1013 100%);
		overflow: hidden;
		padding: 3.5rem 1rem 4.5rem;
	}
	.hero::before,
	.hero::after {
		content: '';
		position: absolute;
		width: 46vmin;
		height: 46vmin;
		border-radius: 50%;
		background: radial-gradient(
			circle at 30% 30%,
			rgba(75, 90, 58, 0.5),
			rgba(75, 90, 58, 0.12) 45%,
			transparent 70%
		);
		filter: blur(28px);
	}
	.hero::before {
		top: -12vmin;
		left: -12vmin;
	}
	.hero::after {
		bottom: -14vmin;
		right: -12vmin;
		background: radial-gradient(
			circle at 60% 60%,
			rgba(106, 74, 80, 0.55),
			rgba(106, 74, 80, 0.15) 45%,
			transparent 70%
		);
	}
	.hero-inner {
		position: relative;
		z-index: 2;
		display: grid;
		justify-items: center;
		gap: 1rem;
	}
	.blush {
		color: var(--blush);
	}
	.hero-comp {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: clamp(0.7rem, 2.5vw, 1.4rem);
	}
	.hero-comp :global(.hero-col) {
		width: clamp(40px, 8vw, 62px);
	}

	/* ---- entrance: columns rise, arch settles, monogram breathes in ---- */
	.hero-comp :global(.hero-col) {
		animation: col-rise 1s cubic-bezier(0.2, 0.7, 0.3, 1) 0.1s both;
	}
	.hero-comp :global(svg.col:nth-of-type(2)) {
		animation-delay: 0.28s;
	}
	.hero-arch {
		animation: arch-in 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) 0.45s both;
	}
	.monogram {
		animation: mono-in 1.4s ease 0.9s both;
	}
	.eyebrow {
		animation: soft-rise 0.9s ease 0.05s both;
	}
	h1 {
		animation: soft-rise 1s ease 0.7s both;
	}
	.hero :global(.ornament),
	.date {
		animation: soft-rise 1s ease 0.95s both;
	}
	.place,
	.count {
		animation: soft-rise 1s ease 1.15s both;
	}
	.quick {
		display: flex;
		gap: 0.9rem;
		margin-top: 0.6rem;
		animation: soft-rise 1s ease 1.35s both;
	}
	.quick a {
		text-decoration: none;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.28em;
		text-indent: 0.28em;
		text-transform: uppercase;
		padding: 0.7rem 1.6rem;
		transition:
			background 0.25s ease,
			border-color 0.25s ease,
			color 0.25s ease;
	}
	.quick-rsvp {
		background: rgba(232, 220, 200, 0.92);
		border: 1px solid rgba(232, 220, 200, 0.92);
		color: var(--claret);
	}
	.quick-rsvp:hover {
		background: var(--parchment);
	}
	.quick-reg {
		border: 1px solid rgba(232, 220, 200, 0.4);
		color: var(--parchment);
	}
	.quick-reg:hover {
		border-color: var(--candle);
		background: rgba(227, 184, 127, 0.08);
	}
	@keyframes col-rise {
		from {
			opacity: 0;
			transform: translateY(46px);
		}
	}
	@keyframes arch-in {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.965);
		}
	}
	@keyframes mono-in {
		from {
			opacity: 0;
			letter-spacing: 0.3em;
		}
	}
	@keyframes soft-rise {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}
	.hero-arch {
		width: min(300px, 60vw);
		aspect-ratio: 3 / 4.1;
		border: 1px solid rgba(230, 217, 198, 0.35);
		outline: 1px solid rgba(230, 217, 198, 0.12);
		outline-offset: 7px;
		display: grid;
		place-items: center;
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(ellipse 90% 55% at 50% 18%, rgba(201, 159, 148, 0.32), transparent 65%),
			radial-gradient(ellipse 70% 50% at 20% 90%, rgba(75, 90, 58, 0.45), transparent 70%),
			radial-gradient(ellipse 70% 55% at 85% 78%, rgba(106, 74, 80, 0.55), transparent 70%),
			linear-gradient(180deg, #503036 0%, #3a2027 60%, #2c1519 100%);
		box-shadow:
			0 30px 80px rgba(0, 0, 0, 0.55),
			inset 0 0 60px rgba(34, 26, 20, 0.5);
	}
	.hero-arch img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* full color; just dim it a touch to settle into the dark hero */
		filter: brightness(0.82) saturate(0.96);
	}
	.duotone {
		position: absolute;
		inset: 0;
		/* duotone overlay toggled OFF to preview the raw photo */
		/* background: linear-gradient(180deg, rgba(201, 159, 148, 0.5), var(--claret) 90%);
		mix-blend-mode: color; */
	}
	.hero-arch.has-photo::after {
		content: '';
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 60px rgba(34, 26, 20, 0.6);
	}
	.monogram {
		font-family: var(--display);
		font-size: clamp(3.2rem, 9vw, 4.6rem);
		color: var(--parchment);
		letter-spacing: 0.06em;
		text-shadow: 0 2px 30px rgba(227, 184, 127, 0.25);
	}
	.monogram i {
		font-style: italic;
		color: var(--blush);
		font-size: 0.5em;
		vertical-align: 0.45em;
		padding: 0 0.15em;
	}
	.photo-note {
		position: absolute;
		bottom: 0.9rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: rgba(230, 217, 198, 0.55);
		white-space: nowrap;
	}
	h1 {
		font-size: clamp(2.4rem, 7.5vw, 5rem);
		letter-spacing: 0.04em;
		color: var(--parchment);
		line-height: 1.08;
	}
	.amp {
		font-style: italic;
		color: var(--blush);
		padding: 0 0.08em;
	}
	.date {
		font-size: 0.9rem;
		letter-spacing: 0.42em;
		text-indent: 0.42em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.place {
		font-style: italic;
		color: var(--thicket);
		font-size: 1.1rem;
		letter-spacing: 0.05em;
	}
	.count {
		font-family: var(--display);
		font-style: italic;
		color: var(--blush);
		font-size: 1.05rem;
		margin-top: 0.3rem;
	}
</style>
