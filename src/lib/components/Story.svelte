<script lang="ts">
	import { CHAPTERS, TIMELINE } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import MirrorFrame from './MirrorFrame.svelte';
	import SectionHead from './SectionHead.svelte';
</script>

<section class="block story" id="story">
	<div class="wrap">
		<SectionHead eyebrow="Our story" title="A story in three chapters" seed={11} />

		{#each CHAPTERS as chapter, i (chapter.numeral)}
			<article class="chapter" class:rev={i % 2 === 1} use:reveal>
				<div class="ch-photo">
					<MirrorFrame
						plates={chapter.plates}
						alt={chapter.title}
						ivy={i !== 1}
						seed={41 + i}
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
	}
	.story-copy {
		display: grid;
		gap: 1rem;
	}
	.ch-num {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.72rem;
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
		font-weight: 400;
		font-size: 0.76rem;
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
