<script lang="ts">
	import { dividerIvy } from '$lib/ivy';
	import { reveal } from '$lib/reveal';
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		lede = '',
		seed = 10,
		vine = true,
		children
	}: {
		eyebrow: string;
		title: string;
		lede?: string;
		seed?: number;
		vine?: boolean;
		children?: Snippet;
	} = $props();
</script>

<div class="block-head" use:reveal>
	<div class="eyebrow">{eyebrow}</div>
	<h2>{title}</h2>
	{#if vine}
		<svg class="vine-h" use:dividerIvy={{ seed }} aria-hidden="true" viewBox="0 0 320 34"></svg>
	{:else}
		<div class="ornament"><span>❦</span></div>
	{/if}
	{#if lede}
		<p class="lede">{lede}</p>
	{/if}
	{@render children?.()}
</div>

<style>
	.block-head {
		text-align: center;
		margin-bottom: clamp(2.5rem, 6vw, 4rem);
		display: grid;
		gap: 0.8rem;
		justify-items: center;
	}
	.block-head h2 {
		font-size: clamp(2rem, 4.5vw, 3rem);
		color: var(--parchment);
	}
</style>
