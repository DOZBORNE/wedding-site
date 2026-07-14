<script lang="ts">
	// The "magic mirror": an arch-framed stack of photos guests can flip
	// through — each turn shimmers like a disturbed reflection.
	import { TONES } from '$lib/config';
	import { cornerIvy } from '$lib/ivy';

	type Plate = { src: string; caption: string; tone: string };

	let {
		plates,
		alt = '',
		ivy = false,
		seed = 40,
		progress = -1
	}: { plates: Plate[]; alt?: string; ivy?: boolean; seed?: number; progress?: number } = $props();

	let index = $state(0);
	let shimmer = $state(false);
	let startX = 0;
	let lastUserTurn = 0;

	function swapTo(i: number) {
		if (i === index) return;
		shimmer = true;
		index = i;
		setTimeout(() => (shimmer = false), 650);
	}

	// scroll-driven page turning: the pinned chapter's scroll progress selects
	// the plate evenly, unless the reader turned it by hand in the last few seconds
	const scrollTarget = $derived(
		progress < 0 ? -1 : Math.min(plates.length - 1, Math.floor(progress * plates.length))
	);
	$effect(() => {
		if (scrollTarget >= 0 && Date.now() - lastUserTurn > 3500) swapTo(scrollTarget);
	});

	function go(delta: number) {
		if (plates.length < 2) return;
		lastUserTurn = Date.now();
		swapTo((index + delta + plates.length) % plates.length);
	}

	function pointerDown(e: PointerEvent) {
		startX = e.clientX;
	}
	function pointerUp(e: PointerEvent) {
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
	}
</script>

<figure class="mirror-wrap">
	{#if ivy}
		<div class="mirror arch" use:cornerIvy={{ seed }}>
			{#each plates as plate, i (i)}
				<div
					class="plate"
					class:active={i === index}
					style={plate.src ? '' : `background:${TONES[plate.tone] ?? TONES.blush}`}
				>
					{#if plate.src}
						<img src={plate.src} alt="{alt} — {plate.caption}" loading="lazy" />
					{:else}
						<span class="photo-note">photo · {plate.caption}</span>
					{/if}
				</div>
			{/each}
			<div class="sheen" class:on={shimmer} aria-hidden="true"></div>
			<button
				class="hit"
				aria-label="Next photo"
				onclick={() => go(1)}
				onpointerdown={pointerDown}
				onpointerup={pointerUp}
			></button>
		</div>
	{:else}
		<div class="mirror arch">
			{#each plates as plate, i (i)}
				<div
					class="plate"
					class:active={i === index}
					style={plate.src ? '' : `background:${TONES[plate.tone] ?? TONES.blush}`}
				>
					{#if plate.src}
						<img src={plate.src} alt="{alt} — {plate.caption}" loading="lazy" />
					{:else}
						<span class="photo-note">photo · {plate.caption}</span>
					{/if}
				</div>
			{/each}
			<div class="sheen" class:on={shimmer} aria-hidden="true"></div>
			<button
				class="hit"
				aria-label="Next photo"
				onclick={() => go(1)}
				onpointerdown={pointerDown}
				onpointerup={pointerUp}
			></button>
		</div>
	{/if}

	{#if plates.length > 1}
		<div class="controls">
			<button class="turn" aria-label="Previous photo" onclick={() => go(-1)}>‹</button>
			<div class="dots" role="tablist" aria-label="Photos">
				{#each plates as _, i (i)}
					<button
						class="dot"
						class:on={i === index}
						role="tab"
						aria-selected={i === index}
						aria-label="Photo {i + 1}"
						onclick={() => {
							lastUserTurn = Date.now();
							swapTo(i);
						}}
					></button>
				{/each}
			</div>
			<button class="turn" aria-label="Next photo" onclick={() => go(1)}>›</button>
		</div>
	{/if}
	<figcaption class="caption"><i>{plates[index].caption}</i></figcaption>
</figure>

<style>
	.mirror-wrap {
		margin: 0;
		display: grid;
		gap: 0.6rem;
		justify-items: center;
	}
	.mirror {
		width: 100%;
		aspect-ratio: 3 / 4;
		position: relative;
		border: 1px solid rgba(230, 217, 198, 0.3);
		outline: 1px solid rgba(230, 217, 198, 0.1);
		outline-offset: 6px;
		overflow: hidden;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
	}
	.plate {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		opacity: 0;
		filter: blur(7px);
		transform: scale(1.04);
		/* hidden plates leave the compositor entirely once faded out */
		visibility: hidden;
		transition:
			opacity 0.6s ease,
			filter 0.6s ease,
			transform 0.6s ease,
			visibility 0s 0.6s;
	}
	.plate.active {
		opacity: 1;
		filter: blur(0);
		transform: none;
		visibility: visible;
		transition:
			opacity 0.6s ease,
			filter 0.6s ease,
			transform 0.6s ease,
			visibility 0s;
	}
	.plate img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo-note {
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: rgba(230, 217, 198, 0.55);
		text-align: center;
		align-self: end;
		padding-bottom: 1rem;
	}
	/* the mirror's surface catching light as it turns */
	.sheen {
		position: absolute;
		inset: -30%;
		background: linear-gradient(
			115deg,
			transparent 42%,
			rgba(232, 220, 200, 0.22) 50%,
			transparent 58%
		);
		transform: translateX(-120%);
		pointer-events: none;
	}
	.sheen.on {
		transition: transform 0.65s ease;
		transform: translateX(120%);
	}
	.hit {
		position: absolute;
		inset: 0;
		background: none;
		border: none;
		cursor: pointer;
		touch-action: pan-y;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.turn {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: var(--display);
		font-size: 1.1rem;
		line-height: 1;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		cursor: pointer;
		transition:
			color 0.2s ease,
			border-color 0.2s ease;
	}
	.turn:hover {
		color: var(--parchment);
		border-color: var(--candle);
	}
	.dots {
		display: flex;
		gap: 0.5rem;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		border: 1px solid var(--ink-faint);
		background: transparent;
		padding: 0;
		cursor: pointer;
	}
	.dot.on {
		background: var(--candle);
		border-color: var(--candle);
	}
	.caption {
		color: var(--ink-faint);
		font-size: 0.9rem;
	}
</style>
