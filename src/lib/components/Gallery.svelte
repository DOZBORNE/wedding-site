<script lang="ts">
	import { COUPLE, GALLERY, TONES } from '$lib/config';
	import { cornerIvy } from '$lib/ivy';
	import SectionHead from './SectionHead.svelte';

	let flipped = $state(GALLERY.map(() => false));
	let gridEl = $state<HTMLDivElement>();
	let lightbox = $state<number | null>(null);
	let dialog = $state<HTMLDialogElement>();

	// deal the cards: flip face-up one by one when the wall scrolls into view
	$effect(() => {
		if (!gridEl) return;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let timers: ReturnType<typeof setTimeout>[] = [];
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					io.disconnect();
					GALLERY.forEach((_, i) => {
						timers.push(setTimeout(() => (flipped[i] = true), reduced ? 0 : 250 + i * 170));
					});
				}
			},
			{ threshold: 0.2 }
		);
		io.observe(gridEl);
		return () => {
			io.disconnect();
			timers.forEach(clearTimeout);
		};
	});

	function tap(i: number) {
		if (flipped[i] && GALLERY[i].src) {
			lightbox = i;
			dialog?.showModal();
		} else {
			flipped[i] = !flipped[i];
		}
	}
	function close() {
		lightbox = null;
		dialog?.close();
	}
	function step(delta: number) {
		if (lightbox === null) return;
		let next = lightbox;
		do {
			next = (next + delta + GALLERY.length) % GALLERY.length;
		} while (!GALLERY[next].src && next !== lightbox);
		lightbox = next;
	}
</script>

{#snippet cardInner(i: number)}
	<button
		class="flip"
		aria-label={flipped[i] ? `View photo: ${GALLERY[i].caption}` : `Turn card ${i + 1} over`}
		aria-pressed={flipped[i]}
		onclick={() => tap(i)}
	>
		<span class="flip-inner" class:up={flipped[i]}>
			<span class="face back arch" aria-hidden="true">
				<span class="back-frame"></span>
				<span class="back-fleuron top">❦</span>
				<span class="back-mono">{COUPLE.monogram[0]}<em>&amp;</em>{COUPLE.monogram[1]}</span>
				<span class="back-fleuron">❦</span>
			</span>
			<span
				class="face front arch"
				style={GALLERY[i].src ? '' : `background:${TONES[GALLERY[i].tone]}`}
			>
				{#if GALLERY[i].src}
					<img src={GALLERY[i].src} alt={GALLERY[i].caption} loading="lazy" />
				{:else}
					<span class="photo-note">photo {String(i + 1).padStart(2, '0')}</span>
				{/if}
			</span>
		</span>
	</button>
{/snippet}

<svelte:window
	onkeydown={(e) => {
		if (lightbox === null) return;
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}}
/>

<section class="block" id="gallery">
	<div class="wrap">
		<SectionHead
			eyebrow="Gallery"
			title="The two of us"
			seed={12}
			lede="Our engagement photos, dealt like cards along a garden wall — turn them over."
		/>
		<div class="gallery-grid" bind:this={gridEl}>
			{#each GALLERY as photo, i (i)}
				{#if i % 3 === 1}
					<figure class="g-frame arch" class:tall={photo.tall} use:cornerIvy={{ seed: 60 + i }}>
						{@render cardInner(i)}
						<figcaption class="g-caption"><i>{photo.caption}</i></figcaption>
					</figure>
				{:else}
					<figure class="g-frame arch" class:tall={photo.tall}>
						{@render cardInner(i)}
						<figcaption class="g-caption"><i>{photo.caption}</i></figcaption>
					</figure>
				{/if}
			{/each}
		</div>
	</div>
</section>

<dialog bind:this={dialog} class="lightbox" onclick={close}>
	{#if lightbox !== null && GALLERY[lightbox].src}
		<img src={GALLERY[lightbox].src} alt={GALLERY[lightbox].caption} />
		<p><i>{GALLERY[lightbox].caption}</i></p>
	{/if}
</dialog>

<style>
	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(1.4rem, 3vw, 2rem);
		align-items: end;
	}
	@media (max-width: 700px) {
		.gallery-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.g-frame {
		position: relative;
		margin: 0 0 2rem;
		border: 1px solid rgba(230, 217, 198, 0.28);
		outline: 1px solid rgba(230, 217, 198, 0.09);
		outline-offset: 5px;
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.4);
		aspect-ratio: 3 / 3.9;
	}
	.g-frame:nth-child(3n + 2) {
		margin-bottom: 4rem;
	}
	.g-frame:nth-child(3n) {
		margin-bottom: 3rem;
	}
	.g-frame.tall {
		aspect-ratio: 3 / 4.4;
	}

	/* ---- the card flip ---- */
	.flip {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		background: none;
		cursor: pointer;
		perspective: 1100px;
	}
	.flip-inner {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
		transition: transform 0.85s cubic-bezier(0.35, 0.1, 0.2, 1);
	}
	.flip-inner.up {
		transform: rotateY(180deg);
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.face.front {
		transform: rotateY(180deg);
	}
	.face.front img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* engraved parchment card back */
	.face.back {
		background:
			radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255, 255, 255, 0.3), transparent 60%),
			linear-gradient(160deg, var(--parchment) 0%, var(--parchment-deep) 100%);
		display: grid;
		grid-template-rows: auto 1fr auto;
		justify-items: center;
		align-items: center;
		padding: 18% 0;
	}
	.back-frame {
		position: absolute;
		inset: 9px;
		border: 1px solid rgba(58, 36, 32, 0.4);
		border-radius: inherit;
	}
	.back-frame::after {
		content: '';
		position: absolute;
		inset: 5px;
		border: 1px solid rgba(58, 36, 32, 0.22);
		border-radius: inherit;
	}
	.back-mono {
		font-family: var(--display);
		font-size: clamp(1.8rem, 5vw, 2.6rem);
		color: rgba(58, 36, 32, 0.55);
		letter-spacing: 0.04em;
	}
	.back-mono em {
		font-style: italic;
		color: rgba(106, 74, 80, 0.75);
		font-size: 0.55em;
		vertical-align: 0.35em;
	}
	.back-fleuron {
		color: rgba(106, 74, 80, 0.6);
		font-size: 0.85rem;
	}

	.photo-note {
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: rgba(230, 217, 198, 0.55);
	}
	.g-caption {
		position: absolute;
		bottom: -1.9rem;
		left: 0;
		right: 0;
		text-align: center;
		color: var(--ink-muted);
		font-size: 1.02rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.lightbox {
		box-sizing: border-box;
		background: rgba(20, 14, 11, 0.94);
		border: none;
		width: 100vw;
		max-width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-height: 100dvh;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 2rem);
		overflow: hidden;
	}
	.lightbox:not([open]) {
		display: none;
	}
	/* cap by height so photos read as one size in the lightbox, but let
	   max-width: 100% (of the padded dialog) take over on narrow screens
	   so a tall portrait never renders wider than the phone. */
	.lightbox img {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: min(78vh, 660px);
		object-fit: contain;
		border: 1px solid rgba(230, 217, 198, 0.3);
	}
	.lightbox p {
		color: var(--parchment);
		font-family: var(--body);
		font-size: 1.2rem;
		font-weight: 600;
		margin: 1rem 0 0;
	}
</style>
