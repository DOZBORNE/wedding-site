<script lang="ts">
	import { CHAPTERS, TIMELINE } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import MirrorFrame from './MirrorFrame.svelte';
	import SectionHead from './SectionHead.svelte';

	// scroll progress per chapter (0 → entering, 1 → read) drives the
	// storybook: plates turn, photos drift, the binding stem fills in
	let progress = $state<number[]>(CHAPTERS.map(() => 0));
	let chapterEls: HTMLElement[] = [];
	let reduced = $state(false);

	$effect(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let raf = 0;
		const measure = () => {
			raf = 0;
			const vh = window.innerHeight;
			const next = chapterEls.map((el) => {
				if (!el) return 0;
				const rect = el.getBoundingClientRect();
				const p = (vh * 0.8 - rect.top) / (rect.height + vh * 0.4);
				return Math.min(1, Math.max(0, p));
			});
			if (next.some((p, i) => Math.abs(p - progress[i]) > 0.005)) progress = next;
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
	<div class="wrap">
		<SectionHead eyebrow="Our story" title="A story in three chapters" seed={11} />

		{#each CHAPTERS as chapter, i (chapter.numeral)}
			{#if i > 0}
				<div class="binding" aria-hidden="true">
					<span
						class="stem"
						style="transform: scaleY({Math.min(1, progress[i] * 2.2)})"
					></span>
					<i class="bud" class:lit={progress[i] > 0.12}>❦</i>
				</div>
			{/if}
			<article
				class="chapter"
				class:rev={i % 2 === 1}
				bind:this={chapterEls[i]}
				style="--p:{reduced ? 0.5 : progress[i]}"
				use:reveal
			>
				<div class="ch-photo">
					<MirrorFrame
						plates={chapter.plates}
						alt={chapter.title}
						ivy={i !== 1}
						seed={41 + i}
						progress={progress[i]}
					/>
				</div>
				<div class="story-copy">
					<div class="ch-num">{chapter.numeral}</div>
					<h3>{chapter.title}</h3>
					<p class="drop">{chapter.body}</p>
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
	.chapter {
		display: grid;
		grid-template-columns: 0.85fr 1.15fr;
		gap: clamp(2rem, 5vw, 4rem);
		align-items: center;
		padding: clamp(2rem, 5vw, 3.5rem) 0;
	}
	.chapter.rev .ch-photo {
		order: 2;
	}
	@media (max-width: 760px) {
		.chapter {
			grid-template-columns: 1fr;
		}
		.chapter.rev .ch-photo {
			order: 0;
		}
	}
	.ch-photo {
		max-width: 340px;
		width: 100%;
		margin: 0 auto;
		/* gentle parallax drift as the chapter scrolls through */
		transform: translateY(calc((0.5 - var(--p, 0.5)) * 34px));
		will-change: transform;
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
	}
	.stem {
		width: 1px;
		flex: 1;
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
