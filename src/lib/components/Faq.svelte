<script lang="ts">
	import { FAQ } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';

	let open = $state<number | null>(null);
	let heights = $state<number[]>(FAQ.map(() => 0));
</script>

<section class="block" id="faq">
	<div class="wrap narrow">
		<SectionHead eyebrow="Questions" title="Asked & answered" seed={16} />
		<div class="list" use:reveal>
			{#each FAQ as item, i (item.q)}
				<div class="qa" class:open={open === i}>
					<button
						class="q"
						aria-expanded={open === i}
						aria-controls="faq-a-{i}"
						onclick={() => (open = open === i ? null : i)}
					>
						{item.q}
						<span class="mark" aria-hidden="true">❦</span>
					</button>
					<div
						class="a"
						id="faq-a-{i}"
						role="region"
						style="max-height: {open === i ? heights[i] + 24 : 0}px"
					>
						<p bind:clientHeight={heights[i]}>{item.a}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.narrow {
		max-width: 780px;
	}
	.list {
		display: grid;
	}
	.qa {
		border-top: 1px solid var(--line);
	}
	.qa:last-child {
		border-bottom: 1px solid var(--line);
	}
	.q {
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		text-align: left;
		padding: 1.2rem 0.2rem;
		font-family: var(--display);
		font-size: 1.2rem;
		color: var(--parchment);
		transition: color 0.3s ease;
	}
	.qa.open .q,
	.q:hover {
		color: var(--candle);
	}
	.mark {
		color: var(--mauve);
		font-size: 0.85rem;
		flex: none;
		transition:
			transform 0.45s cubic-bezier(0.34, 1.4, 0.5, 1),
			color 0.45s ease;
	}
	.qa.open .mark {
		transform: rotate(180deg) scale(1.15);
		color: var(--candle);
	}
	.a {
		overflow: hidden;
		max-height: 0;
		transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.a p {
		margin: 0;
		padding: 0 0.2rem 1.4rem;
		color: var(--ink-muted);
		max-width: 62ch;
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity 0.4s ease 0.12s,
			transform 0.4s ease 0.12s;
	}
	.qa.open .a p {
		opacity: 1;
		transform: none;
	}
</style>
