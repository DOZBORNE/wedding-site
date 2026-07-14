<script lang="ts">
	// Tiny inline icons (Lucide paths) — unicode arrows like ↗ render as
	// emoji on iOS, so anything icon-like must be drawn, not typed.
	let { name, size = '1em' }: { name: 'out' | 'left'; size?: string } = $props();
</script>

<svg
	class="ic"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'out'}
		<path d="M7 17 17 7" /><path d="M8 7h9v9" />
	{:else}
		<path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
	{/if}
</svg>

<style>
	.ic {
		display: inline-block;
		vertical-align: -0.14em;
		flex: none;
	}
</style>
