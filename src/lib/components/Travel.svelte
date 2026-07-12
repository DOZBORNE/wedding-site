<script lang="ts">
	import { TRAVEL } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';
</script>

<section class="block" id="travel">
	<div class="wrap">
		<SectionHead
			eyebrow="Travel & stay"
			title="Getting here, staying near"
			seed={15}
		/>
		<div class="cards" use:reveal>
			{#each TRAVEL as item (item.title)}
				<div class="t-card">
					<h3>{item.title}</h3>
					<p>{item.body}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: clamp(1.2rem, 3vw, 2rem);
	}
	.t-card {
		border: 1px solid var(--line);
		padding: 2rem 1.7rem;
		background: rgba(34, 26, 20, 0.45);
		display: grid;
		gap: 0.7rem;
		align-content: start;
	}
	h3 {
		font-size: 1.4rem;
		color: var(--parchment);
	}
	p {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
