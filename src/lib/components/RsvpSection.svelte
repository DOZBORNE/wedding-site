<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { COUPLE } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import RsvpForm from './RsvpForm.svelte';
	import Seal from './Seal.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { PublicParty } from '$lib/types';

	let {
		party = null,
		hasCodeInUrl = false
	}: {
		/** Resolved from `?code=` (or a returning session) by the page load. */
		party?: PublicParty | null;
		hasCodeInUrl?: boolean;
	} = $props();

	// A party that has already replied gets its envelope open on arrival — there's
	// nothing to unseal, they're here to read or change what they sent. Seeded at
	// first render so it paints open rather than animating itself open.
	// svelte-ignore state_referenced_locally
	let open = $state(!!party?.responded_at);
	let scene: HTMLDivElement | undefined = $state();
	let card: HTMLDivElement | undefined = $state();

	function breakSeal() {
		open = true;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		setTimeout(
			() => card?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }),
			reduced ? 0 : 950
		);
	}

	/**
	 * The card is absolutely positioned, so the scene has to be told how tall it is.
	 * It's measured continuously rather than once at open: the form grows and shrinks
	 * as guests accept, decline, or add a plus-one, and a stale measurement leaves the
	 * bottom of the form overlapping the guestbook.
	 */
	onMount(() => {
		if (!card || !scene) return;
		const fit = () => {
			if (open && card && scene) scene.style.minHeight = `${card.offsetHeight + 40}px`;
		};
		const ro = new ResizeObserver(fit);
		ro.observe(card);
		fit();
		return () => ro.disconnect();
	});

	$effect(() => {
		// re-fit on the open transition itself (ResizeObserver won't fire if the
		// card's height happens to be unchanged from its hidden state)
		if (open && card && scene) scene.style.minHeight = `${card.offsetHeight + 40}px`;
	});

	// The invite code is a credential; once it's been exchanged for a session there's
	// no reason to leave it in the address bar to be screenshotted or shared onward.
	onMount(() => {
		if (!hasCodeInUrl) return;
		const url = new URL(location.href);
		url.searchParams.delete('code');
		try {
			replaceState(url.pathname + url.search + url.hash, {});
		} catch {
			/* router not ready — harmless, the code just stays visible */
		}
	});
</script>

<section class="block" id="rsvp">
	<div class="wrap">
		<SectionHead
			eyebrow="Kindly reply"
			title="RSVP"
			seed={17}
			lede={party
				? party.responded_at
					? 'Your reply is in. Everything below is exactly as you sent it — change anything you like.'
					: 'Your invitation is waiting. Break the wax to open it.'
				: 'Your reply arrives sealed. Break the wax to open it.'}
		/>

		<div class="rsvp-scene" class:open bind:this={scene} use:reveal>
			<div class="envelope" aria-hidden={open}>
				<div class="env-body">
					<div class="env-address" class:for-party={!!party}>
						{#if party}
							<div class="env-to">For</div>
							<div class="env-names">{party.display_name}</div>
							<div class="env-sub">
								from {COUPLE.first} &amp; {COUPLE.partnerFirst}
							</div>
						{:else}
							<div class="env-names">{COUPLE.first} &amp; {COUPLE.partnerFirst}</div>
							<div class="env-sub">request the pleasure of your reply</div>
						{/if}
					</div>
				</div>
				<div class="env-flap" aria-hidden="true"></div>
				<button
					class="seal-btn"
					aria-expanded={open}
					aria-controls="rsvp-card"
					aria-label={party ? `Open the invitation for ${party.display_name}` : 'Open the RSVP form'}
					onclick={breakSeal}
				>
					<Seal size="var(--seal)" />
					<span class="seal-hint">RSVP</span>
				</button>
			</div>

			<div class="rsvp-card parchment-card" id="rsvp-card" bind:this={card} aria-hidden={!open}>
				<div class="card-seal"><Seal size={60} /></div>
				<RsvpForm {party} />
			</div>
		</div>
	</div>
</section>

<style>
	.rsvp-scene {
		position: relative;
		max-width: 860px;
		margin: 0 auto;
		min-height: 480px;
		perspective: 1400px;
		transition: min-height 0.6s ease;
	}
	.envelope {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		/* The envelope stays a hair narrower than the card it opens into — it reads
		   as an object on the table rather than a panel the width of the page. */
		width: min(620px, 94%);
		/*
		 * Three measurements drive the whole envelope interior, so the seal and the
		 * address can't be positioned into each other by accident:
		 *   --flap  where the flap's V converges; the seal is centred on that point
		 *   --seal  the wax seal's diameter
		 *   --hint  the "RSVP" caption under the seal, plus its gap and padding
		 * The address then starts below the seal's real bottom edge, computed rather
		 * than eyeballed. It used to be pinned to `bottom: 8%`, which was fine for the
		 * two-line generic case and collided with the seal as soon as a party name
		 * added a third line — worst on a phone, where the envelope is shortest.
		 */
		--flap: 52%;
		--seal: clamp(46px, 12.5vw, 76px);
		/* Grown with the caption — .seal-hint is bolder and a notch larger now, so
		   the band it needs under the seal is taller too. */
		--hint: 2rem;
		aspect-ratio: 8 / 5;
		transform-style: preserve-3d;
		transition:
			opacity 0.6s ease 0.45s,
			transform 0.6s ease 0.45s;
	}
	/* A phone's envelope is barely 200px tall at 8/5 — nowhere near enough room under
	   the seal for three lines. Give it back some height as the screen narrows. */
	@media (max-width: 720px) {
		.envelope {
			aspect-ratio: 3 / 2;
		}
	}
	@media (max-width: 520px) {
		.envelope {
			aspect-ratio: 6 / 5;
		}
	}
	/* Below this a two-word household name wraps, and the wrapped line is what runs
	   into the seal. Nearly square is unusual for an envelope but reads fine at phone
	   width, and it's the only place the extra height can come from. */
	@media (max-width: 400px) {
		.envelope {
			aspect-ratio: 9 / 8;
		}
	}
	/*
	 * On the very smallest phones a long household name wraps to two lines and even a
	 * near-square envelope can't hold four lines clear of the seal. Drop the "from
	 * Devin & Jessica" line, which is the one thing on this envelope the guest already
	 * knows — the page they're standing on says it twice. Only on a party envelope:
	 * the generic version needs its second line, which is the actual invitation.
	 */
	@media (max-width: 360px) {
		.for-party .env-sub {
			display: none;
		}
	}
	.env-body {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 120% 60% at 50% 115%, rgba(255, 255, 255, 0.28), transparent 60%),
			linear-gradient(160deg, var(--parchment) 0%, var(--parchment-deep) 100%);
		box-shadow:
			0 34px 80px rgba(0, 0, 0, 0.6),
			inset 0 0 40px rgba(74, 46, 31, 0.12);
	}
	.env-body::after {
		content: '';
		position: absolute;
		inset: 9px;
		border: 1px solid rgba(58, 36, 32, 0.3);
		pointer-events: none;
	}
	.env-address {
		position: absolute;
		left: 0;
		right: 0;
		/* Starts where the seal ends — half the seal below the flap tip, plus the
		   caption beneath it — so the two can never share vertical space. */
		top: calc(var(--flap) + var(--seal) / 2 + var(--hint));
		bottom: 4.5%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		/* Long household names ran to the paper's edge; the envelope's inner rule sits
		   at 9px, so keep the text well inside it. */
		padding-inline: 9%;
		text-align: center;
		color: var(--chocolate);
		z-index: 1;
	}
	.env-names {
		font-family: var(--display);
		font-style: italic;
		font-weight: 500;
		font-size: clamp(1.1rem, 4.6vw, 1.5rem);
		line-height: 1.14;
		color: var(--claret);
		/* "The Vanderhoeven-Whitfield Family" has to wrap somewhere. */
		overflow-wrap: break-word;
		text-wrap: balance;
	}
	.env-to {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--ink-label);
		opacity: 0.8;
		margin-bottom: 0.2rem;
	}
	.env-sub {
		font-size: 0.76rem;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-top: 0.3rem;
		/* Secondary to the name — first thing to go when the band is tight. */
		overflow-wrap: break-word;
	}
	.env-flap {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: var(--flap);
		clip-path: polygon(0 0, 100% 0, 50% 100%);
		background: linear-gradient(180deg, #decdb1, #c6b190 88%, #b9a382);
		transform-origin: top center;
		transition: transform 0.7s cubic-bezier(0.6, 0, 0.3, 1);
		z-index: 2;
	}
	.env-flap::after {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(0 0, 100% 0, 50% 100%);
		box-shadow: inset 0 -14px 24px rgba(58, 36, 32, 0.18);
	}
	.seal-btn {
		position: absolute;
		left: 50%;
		top: var(--flap);
		transform: translate(-50%, -50%);
		z-index: 3;
		background: none;
		border: none;
		padding: 0.4rem;
		cursor: pointer;
		display: grid;
		justify-items: center;
		gap: 0.55rem;
		font-family: inherit;
		transition:
			transform 0.5s ease,
			opacity 0.35s ease 0.1s;
	}
	.seal-btn:hover :global(.seal) {
		transform: scale(1.05) rotate(-3deg);
	}
	.seal-hint {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.26em;
		text-indent: 0.26em;
		text-transform: uppercase;
		color: var(--ink-label);
	}
	.open .env-flap {
		transform: rotateX(178deg);
	}
	.open .seal-btn {
		transform: translate(-50%, -50%) scale(0.55) rotate(-16deg);
		opacity: 0;
		pointer-events: none;
	}
	.open .envelope {
		opacity: 0;
		transform: translate(-50%, -34%) scale(0.93);
		pointer-events: none;
	}
	.rsvp-card {
		position: absolute;
		left: 50%;
		top: 0;
		transform: translateX(-50%) translateY(90px);
		width: 100%;
		max-width: 820px;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 0.7s ease 0.55s,
			transform 0.7s ease 0.55s,
			visibility 0s 0.55s;
		padding: clamp(2rem, 6vw, 3.2rem);
		text-align: center;
	}
	.open .rsvp-card {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translateX(-50%) translateY(0);
	}
	.card-seal {
		display: flex;
		justify-content: center;
		margin: -60px auto 1rem;
	}
</style>
