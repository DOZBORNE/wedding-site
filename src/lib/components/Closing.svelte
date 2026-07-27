<script lang="ts">
	import { COUPLE } from '$lib/config';
	import { flankIvy } from '$lib/ivy';
	import { reveal } from '$lib/reveal';
	import Column from './Column.svelte';
</script>

<!--
  The last thing on the page, and the counterpart to the hero. The hero is a
  tall niche: two columns and a portrait arch, newly built. This is the same
  order turned on its side — a wide garden gateway, grown over. The photo is
  the opening; a stone archivolt rings it and closes on a carved keystone;
  the columns rise exactly to the springline, so they carry the arch instead
  of standing next to it. Wordless on purpose — the footer underneath has
  the closing lines.
-->
<section class="closing" use:reveal>
	<div class="wrap">
		<div class="span" use:flankIvy={{ seed: 7, crown: true }}>
			<Column class="close-col" />
			<div class="archivolt">
				<div class="bay">
					<img
						src="/photos/jess_dev_dancing.jpg"
						alt="{COUPLE.first} and {COUPLE.partnerFirst} reaching for each other's hands beside a hydrangea hedge"
						width="1000"
						height="667"
						loading="lazy"
						decoding="async"
						fetchpriority="low"
					/>
				</div>
				<span class="keystone" aria-hidden="true">❦</span>
			</div>
			<Column class="close-col" />
		</div>
		<div class="plinth" aria-hidden="true"></div>
	</div>
</section>

<style>
	.closing {
		/* one number drives the whole order: the arch springs at 68% of this,
		   and the columns are sized to reach exactly that line */
		--bay-h: clamp(230px, 44vh, 460px);
		--ring: clamp(7px, 0.95vw, 13px);
		position: relative;
		padding-bottom: clamp(2.5rem, 6vw, 4.5rem);
	}
	/* the order is capped well inside the container: at full width the shafts
	   read as toothpicks against the span they are meant to carry */
	.span {
		position: relative;
		max-width: 860px;
		margin: 0 auto;
		display: flex;
		align-items: flex-end;
		/* all but touching: engaged columns, not columns standing nearby */
		gap: clamp(0.1rem, 0.4vw, 0.35rem);
	}
	/* column height = 72% of the bay, which lands the capitals on the
	   springline — derived from the arch, not guessed */
	.span :global(.close-col) {
		width: calc(var(--bay-h) * 0.72 * 80 / 460);
	}

	/* the stone ring the arch is turned in */
	.archivolt {
		position: relative;
		flex: 1;
		min-width: 0;
		padding: var(--ring);
		border-radius: 50% 50% 3px 3px / 32% 32% 3px 3px;
		/* weathered stone at dusk, not new-cut — it has to stay quieter than
		   the photograph it rings */
		background: linear-gradient(180deg, #b6a687 0%, #9a8a6b 45%, #6f6349 100%);
		box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5);
	}
	.bay {
		position: relative;
		overflow: hidden;
		height: var(--bay-h);
		border-radius: 50% 50% 2px 2px / 32% 32% 2px 2px;
		box-shadow: inset 0 0 70px rgba(34, 26, 20, 0.55);
	}
	.bay img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 52%;
		/* a black-and-white print warmed just enough to sit inside the
		   candlelit palette without becoming a sepia postcard */
		filter: sepia(0.26) saturate(0.92) brightness(1.02) contrast(1.03);
	}
	/* the wedge that closes the ring — wide at the top, tapering into it */
	.keystone {
		position: absolute;
		top: calc(-1 * var(--ring) - 0.1rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		width: clamp(38px, 5vw, 62px);
		height: clamp(34px, 4.4vw, 54px);
		clip-path: polygon(0 0, 100% 0, 78% 100%, 22% 100%);
		/* the one lit stone in the order — it is the accent, so it stays
		   brighter than the ring it closes */
		background: linear-gradient(180deg, #e3d4b6 0%, #c9b896 50%, #8f8064 100%);
		display: grid;
		place-items: center;
		padding-bottom: 0.5em;
		font-size: 0.82rem;
		color: rgba(58, 36, 32, 0.5);
		filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.4));
	}

	/* the course the whole order stands on, oversailing it slightly */
	.plinth {
		height: 9px;
		width: min(860px + clamp(0.6rem, 2.4vw, 1.8rem), 100%);
		margin: 0 auto;
		margin-top: 3px;
		background: linear-gradient(180deg, #7d7057 0%, #5d5340 60%, #443c2e 100%);
		box-shadow: 0 14px 30px rgba(0, 0, 0, 0.5);
	}

	@media (max-width: 560px) {
		/* at this width a fluted shaft is thinner than its own flutes — the
		   ring and its keystone carry the order on their own */
		.span :global(.close-col) {
			display: none;
		}
	}
</style>
