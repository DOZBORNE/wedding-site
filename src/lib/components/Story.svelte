<script lang="ts">
	import { CHAPTERS, TIMELINE } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import { fade } from 'svelte/transition';
	import MirrorFrame from './MirrorFrame.svelte';
	import SectionHead from './SectionHead.svelte';

	// which plate each chapter is currently showing — the paragraph follows it
	// when that plate has its own body, otherwise the chapter body stays put
	let activeIndex = $state<number[]>(CHAPTERS.map(() => 0));

	// Each chapter is a tall scroll region with its content pinned (sticky)
	// inside: the page keeps scrolling but the chapter holds still while the
	// reader's scroll pages through its photos — then it releases.
	// progress[i] = how far through chapter i's pinned range we've scrolled.
	let progress = $state<number[]>(CHAPTERS.map(() => 0));
	let stageEls: HTMLElement[] = [];
	let probeEl = $state<HTMLDivElement>();
	let reduced = $state(false);

	$effect(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let raf = 0;
		const measure = () => {
			raf = 0;
			// stable small-viewport height: window.innerHeight changes when the
			// iOS toolbar hides/shows, which made progress (and the pinned
			// chapters) jump on every scroll-direction change
			const vh = probeEl?.offsetHeight || window.innerHeight;
			const next = stageEls.map((el) => {
				if (!el) return 0;
				const rect = el.getBoundingClientRect();
				const travel = rect.height - vh;
				const p = travel > 0 ? -rect.top / travel : (vh * 0.8 - rect.top) / rect.height;
				return Math.min(1, Math.max(0, p));
			});
			if (next.some((p, i) => Math.abs(p - progress[i]) > 0.004)) progress = next;
		};
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<section class="block story" id="story">
	<div class="vh-probe" bind:this={probeEl} aria-hidden="true"></div>
	<div class="wrap">
		<SectionHead eyebrow="Our story" title="A story in three chapters" seed={11} />

		{#each CHAPTERS as chapter, i (chapter.numeral)}
			{#if i > 0}
				<div class="binding" aria-hidden="true">
					<span class="stem" style="transform: scaleY({Math.min(1, progress[i] * 3)})"></span>
					<i class="bud" class:lit={progress[i] > 0.05}>❦</i>
				</div>
			{/if}
			<article
				class="stage"
				bind:this={stageEls[i]}
				style="--extra:{chapter.plates.length * 55}vh"
			>
				<div class="pin">
					<div class="chapter" class:rev={i % 2 === 1} style="--p:{reduced ? 0.5 : progress[i]}" use:reveal>
						<div class="ch-photo">
							<MirrorFrame
								plates={chapter.plates}
								alt={chapter.title}
								ivy={i !== 1}
								seed={41 + i}
								progress={progress[i]}
								bind:index={activeIndex[i]}
							/>
						</div>
						<div class="story-copy">
							<div class="ch-num">{chapter.numeral}</div>
							<h3>{chapter.title}</h3>
							{#key chapter.plates[activeIndex[i]]?.body || chapter.body}
								<p class="drop" in:fade={{ duration: 400 }}>
									{chapter.plates[activeIndex[i]]?.body || chapter.body}
								</p>
							{/key}
						</div>
					</div>
				</div>
			</article>
		{/each}

		<div class="timeline" use:reveal>
			{#each TIMELINE as item, i (item.label)}
				{#if i > 0}<span class="t-sep">❦</span>{/if}
				<div class="t-item"><b>{item.label}</b><i>{item.value}</i></div>
			{/each}
		</div>
	</div>
</section>

<style>
	.story {
		background: linear-gradient(180deg, var(--espresso), #291b15 50%, var(--espresso));
	}
	/* invisible ruler: always exactly 100svh tall, unaffected by the
	   mobile toolbar, so scroll math stays stable */
	.vh-probe {
		position: fixed;
		top: 0;
		left: 0;
		width: 0;
		height: 100vh;
		height: 100svh;
		visibility: hidden;
		pointer-events: none;
	}

	/* tall scroll region; content pins inside while photos page through */
	.stage {
		height: calc(100vh + var(--extra, 110vh));
		height: calc(100svh + var(--extra, 110vh));
	}
	.pin {
		position: sticky;
		top: 0;
		min-height: 100vh;
		min-height: 100svh;
		display: flex;
		align-items: center;
		padding: 4rem 0 2.5rem;
	}

	.chapter {
		width: 100%;
		display: grid;
		grid-template-columns: 0.85fr 1.15fr;
		gap: clamp(2rem, 5vw, 4rem);
		align-items: center;
	}
	.chapter.rev .ch-photo {
		order: 2;
	}
	@media (max-width: 760px) {
		.chapter {
			grid-template-columns: 1fr;
			gap: 1.6rem;
		}
		.chapter.rev .ch-photo {
			order: 0;
		}
	}
	.ch-photo {
		max-width: 340px;
		width: 100%;
		margin: 0 auto;
		/* slight drift while the chapter is pinned */
		transform: translateY(calc((0.5 - var(--p, 0.5)) * 26px));
		will-change: transform;
	}
	@media (max-width: 760px) {
		.ch-photo {
			max-width: min(300px, 72vw);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ch-photo {
			transform: none;
		}
	}

	/* the bookbinding stem between chapters, filling as you read */
	.binding {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		height: 4.6rem;
		position: relative;
		z-index: 1;
	}
	.stem {
		width: 1px;
		height: 3rem;
		background: linear-gradient(180deg, transparent, var(--mauve), var(--olive));
		transform-origin: top;
		transform: scaleY(0);
		transition: transform 0.25s linear;
	}
	.bud {
		color: var(--mauve);
		font-size: 0.9rem;
		opacity: 0.25;
		transition:
			opacity 0.6s ease,
			color 0.6s ease;
	}
	.bud.lit {
		opacity: 1;
		color: var(--candle);
	}

	.story-copy {
		display: grid;
		gap: 1rem;
	}
	/* copy cascades in line by line once the chapter reveals */
	.chapter:global(.reveal) .story-copy > * {
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 0.7s ease,
			transform 0.7s ease;
	}
	.chapter:global(.reveal.in) .story-copy > * {
		opacity: 1;
		transform: none;
	}
	.chapter:global(.reveal.in) .story-copy > :nth-child(1) {
		transition-delay: 0.05s;
	}
	.chapter:global(.reveal.in) .story-copy > :nth-child(2) {
		transition-delay: 0.2s;
	}
	.chapter:global(.reveal.in) .story-copy > :nth-child(3) {
		transition-delay: 0.38s;
	}

	.ch-num {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--candle);
	}
	.ch-num::before {
		content: '';
		height: 1px;
		width: 2.4rem;
		background: var(--mauve);
	}
	h3 {
		font-size: clamp(1.7rem, 3.5vw, 2.4rem);
		color: var(--parchment);
	}
	p {
		max-width: 56ch;
		color: var(--ink-on-dark);
		margin: 0;
	}
	.drop::first-letter {
		font-family: var(--display);
		float: left;
		font-size: 3.4em;
		line-height: 0.82;
		padding: 0.06em 0.12em 0 0;
		color: var(--blush);
	}
	.timeline {
		margin-top: 2.5rem;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1.2rem 1.8rem;
		flex-wrap: wrap;
	}
	@media (max-width: 560px) {
		.timeline {
			flex-direction: column;
			gap: 0.9rem;
		}
	}
	.t-item {
		text-align: center;
		display: grid;
		gap: 0.2rem;
	}
	.t-item b {
		font-weight: 500;
		font-size: 0.78rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.t-item i {
		font-family: var(--display);
		font-style: italic;
		font-size: 1.15rem;
		color: var(--blush);
	}
	.t-sep {
		color: var(--mauve);
		font-size: 0.85rem;
	}
</style>
