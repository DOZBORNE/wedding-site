<script lang="ts">
	import { FAQ } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';
</script>

<section class="block" id="faq">
	<div class="wrap narrow">
		<SectionHead eyebrow="Questions" title="Asked & answered" seed={16} />
		<div class="list" use:reveal>
			{#each FAQ as item (item.q)}
				<details>
					<summary>{item.q}<span class="mark" aria-hidden="true">❦</span></summary>
					<p>{item.a}</p>
				</details>
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
	details {
		border-top: 1px solid var(--line);
	}
	details:last-child {
		border-bottom: 1px solid var(--line);
	}
	summary {
		cursor: pointer;
		list-style: none;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1.2rem 0.2rem;
		font-family: var(--display);
		font-size: 1.2rem;
		color: var(--parchment);
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.mark {
		color: var(--mauve);
		font-size: 0.85rem;
		transition: transform 0.3s ease;
		flex: none;
	}
	details[open] .mark {
		transform: rotate(180deg);
		color: var(--candle);
	}
	details p {
		margin: 0;
		padding: 0 0.2rem 1.4rem;
		color: var(--ink-muted);
		max-width: 62ch;
	}
</style>
