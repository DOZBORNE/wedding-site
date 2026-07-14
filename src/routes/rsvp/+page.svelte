<script lang="ts">
	import { COUPLE, VENUE, WEDDING } from '$lib/config';
	import Icon from '$lib/components/Icon.svelte';
	import RsvpForm from '$lib/components/RsvpForm.svelte';
	import Seal from '$lib/components/Seal.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>RSVP — {COUPLE.first} &amp; {COUPLE.partnerFirst}</title>
</svelte:head>

<main class="rsvp-page">
	<div class="head">
		<div class="eyebrow">{WEDDING.dateLabel} · {VENUE.name}</div>
		<h1>{COUPLE.first} <span class="amp">&amp;</span> {COUPLE.partnerFirst}</h1>
		<div class="ornament"><span>❦</span></div>
	</div>

	<div class="card parchment-card">
		<div class="card-seal"><Seal size={60} /></div>
		<RsvpForm party={data.party} />
	</div>

	<a class="back" href="/"><Icon name="left" /> back to the wedding site</a>
</main>

<style>
	.rsvp-page {
		min-height: 80vh;
		padding: clamp(2.5rem, 7vw, 5rem) 1.25rem 5rem;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 2.4rem;
		background:
			radial-gradient(ellipse 60% 45% at 50% 0%, rgba(201, 159, 148, 0.12), transparent 70%),
			linear-gradient(180deg, #2a1418 0%, var(--espresso) 60%);
	}
	.head {
		text-align: center;
		display: grid;
		gap: 0.7rem;
		justify-items: center;
	}
	h1 {
		font-size: clamp(2rem, 6vw, 3.2rem);
		color: var(--parchment);
	}
	.amp {
		font-style: italic;
		color: var(--blush);
	}
	.card {
		width: min(620px, 100%);
		padding: clamp(2rem, 6vw, 3.2rem);
		text-align: center;
		margin-top: 30px;
	}
	.card-seal {
		display: flex;
		justify-content: center;
		margin: -60px auto 1rem;
	}
	.back {
		font-style: italic;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.back:hover {
		color: var(--parchment);
	}
</style>
