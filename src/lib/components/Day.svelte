<script lang="ts">
	import { VENUE, WEDDING } from '$lib/config';
	import { flankIvy } from '$lib/ivy';
	import { reveal } from '$lib/reveal';
	import Column from './Column.svelte';
	import Icon from './Icon.svelte';
	import SectionHead from './SectionHead.svelte';
	import VenueMap from './VenueMap.svelte';

	const palette = [
		{ name: 'Olive', hex: '#4B5A3A' },
		{ name: 'Thicket', hex: '#8B907F' },
		{ name: 'Deep Mauve', hex: '#6A4A50' },
		{ name: 'Burgundy', hex: '#4B1F24' },
		{ name: 'Claret', hex: '#381015' },
		{ name: 'Chocolate', hex: '#4A2E1F' },
		{ name: 'Cream', hex: '#E8DCC8' }
	];
</script>

<section class="block day" id="day">
	<div class="wrap">
		<SectionHead eyebrow="The wedding day" title="One garden, start to finish" vine={false} />

		<div class="day-comp" use:reveal use:flankIvy={{ seed: 20 }}>
			<Column class="day-col" />
			<div class="day-cards">
				<div class="day-card arch">
					<div class="glyph">❦</div>
					<div class="time">{WEDDING.ceremonyTime}</div>
					<h3>The Ceremony</h3>
					<p>Vows at the water's edge<br />as the light goes gold</p>
				</div>
				<div class="day-card arch">
					<div class="glyph">✦</div>
					<div class="time">{WEDDING.receptionTime}</div>
					<h3>The Reception</h3>
					<p>Dinner, dancing &amp; candlelight<br />under the pavilion</p>
				</div>
			</div>
			<Column class="day-col" />
		</div>

		<div class="dress" use:reveal>
			<div class="eyebrow">What to wear</div>
			<p class="lede">Evening attire in autumnal tones — borrow from our palette:</p>
			<div class="palette-row">
				{#each palette as swatch (swatch.hex)}
					<div class="swatch" title="{swatch.name} {swatch.hex}">
						<span style="background:{swatch.hex}"></span>
						<b>{swatch.name}</b>
					</div>
				{/each}
			</div>
		</div>

		<div class="map-block" use:reveal>
			<div class="eyebrow" style="text-align:center;">Finding the garden</div>
			<VenueMap />
			<div class="directions-row">
				<div class="dir-addr">
					<b>{VENUE.name}</b>
					<i>{VENUE.address}</i>
				</div>
				<div class="dir-btns">
					<a class="ghost-btn" href={VENUE.directionsUrl} target="_blank" rel="noopener">
						Google Maps <Icon name="out" />
					</a>
					<a class="ghost-btn" href={VENUE.appleDirectionsUrl} target="_blank" rel="noopener">
						Apple Maps <Icon name="out" />
					</a>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.day {
		background: linear-gradient(180deg, var(--espresso) 0%, var(--claret) 45%, var(--espresso) 100%);
	}
	.day-comp {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: clamp(0.8rem, 2.5vw, 1.5rem);
		max-width: 980px;
		margin: 0 auto;
	}
	.day-comp :global(.day-col) {
		width: clamp(34px, 5vw, 50px);
	}
	@media (max-width: 680px) {
		.day-comp :global(.day-col) {
			display: none;
		}
	}
	.day-cards {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: clamp(1.2rem, 3vw, 2rem);
	}
	@media (max-width: 680px) {
		.day-cards {
			grid-template-columns: 1fr;
		}
	}
	.day-card {
		border: 1px solid rgba(230, 217, 198, 0.25);
		padding: 2.6rem 1.8rem 2.2rem;
		text-align: center;
		background: rgba(34, 26, 20, 0.35);
		display: grid;
		gap: 0.7rem;
		justify-items: center;
		backdrop-filter: blur(2px);
	}
	.day-card h3 {
		font-size: 1.75rem;
		color: var(--parchment);
		letter-spacing: 0.04em;
	}
	.time {
		font-size: 0.82rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		color: var(--candle);
	}
	.day-card p {
		margin: 0;
		color: var(--ink-muted);
		font-style: italic;
	}
	.glyph {
		color: var(--mauve);
		font-size: 1.1rem;
		letter-spacing: 0.5em;
		text-indent: 0.5em;
	}
	.dress {
		margin-top: clamp(3rem, 6vw, 4.5rem);
		text-align: center;
		display: grid;
		gap: 0.8rem;
		justify-items: center;
	}
	.palette-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem 1.4rem;
		margin-top: 0.4rem;
	}
	.swatch {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
	}
	.swatch span {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid rgba(230, 217, 198, 0.3);
		display: block;
	}
	.swatch b {
		font-weight: 400;
		font-size: 0.66rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.map-block {
		margin-top: clamp(3rem, 6vw, 4.5rem);
		display: grid;
		gap: 1.2rem;
	}
	.directions-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1rem 1.5rem;
	}
	.dir-addr {
		display: grid;
		gap: 0.15rem;
	}
	.dir-addr b {
		font-family: var(--display);
		font-weight: 400;
		font-size: 1.25rem;
		color: var(--parchment);
	}
	.dir-addr i {
		color: var(--ink-muted);
	}
	.dir-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
	}
	.dir-btns .ghost-btn {
		padding: 0.8rem 1.5rem;
		font-size: 0.72rem;
	}
	@media (max-width: 760px) {
		.directions-row {
			flex-direction: column;
			justify-content: center;
			text-align: center;
		}
		.dir-addr {
			justify-items: center;
		}
		.dir-btns {
			justify-content: center;
			width: 100%;
		}
		.dir-btns .ghost-btn {
			flex: 1;
			max-width: 220px;
			text-align: center;
		}
	}
</style>
