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
					<div class="env-address">
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
					<Seal size={76} />
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
		max-width: 660px;
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
		width: min(540px, 94%);
		aspect-ratio: 8 / 5;
		transform-style: preserve-3d;
		transition:
			opacity 0.6s ease 0.45s,
			transform 0.6s ease 0.45s;
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
		bottom: 8%;
		text-align: center;
		color: var(--chocolate);
		z-index: 1;
	}
	.env-names {
		font-family: var(--display);
		font-style: italic;
		font-size: 1.35rem;
		color: var(--claret);
	}
	.env-to {
		font-size: 0.62rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		opacity: 0.65;
		margin-bottom: 0.15rem;
	}
	.env-sub {
		font-size: 0.68rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		opacity: 0.75;
		margin-top: 0.2rem;
	}
	.env-flap {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 58%;
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
		top: 58%;
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
		font-size: 0.62rem;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--chocolate);
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
		max-width: 620px;
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
