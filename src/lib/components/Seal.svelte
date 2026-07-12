<script lang="ts">
	import { COUPLE } from '$lib/config';
	let { size = 76 }: { size?: number } = $props();
</script>

<span class="seal" style="width:{size}px; height:{size}px; font-size:{size * 0.34}px" aria-hidden="true">
	{COUPLE.monogram[0]}{COUPLE.monogram[1]}
</span>

<style>
	.seal {
		border-radius: 47% 53% 50% 50% / 52% 48% 52% 48%;
		background: radial-gradient(circle at 34% 30%, #7a2a33, var(--claret) 65%, #240a0e);
		box-shadow:
			0 8px 20px rgba(0, 0, 0, 0.5),
			inset 0 2px 6px rgba(255, 255, 255, 0.18),
			inset 0 -4px 10px rgba(0, 0, 0, 0.45);
		display: grid;
		place-items: center;
		font-family: var(--display);
		font-style: italic;
		color: rgba(232, 220, 200, 0.9);
		user-select: none;
	}
</style>
