<script lang="ts">
	import { GALLERY, TONES } from '$lib/config';
	import { cornerIvy } from '$lib/ivy';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';

	let lightbox = $state<number | null>(null);
	let dialog: HTMLDialogElement | undefined = $state();

	function openAt(i: number) {
		if (!GALLERY[i].src) return; // placeholders don't need a lightbox
		lightbox = i;
		dialog?.showModal();
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
			lede="Our engagement photos as a colonnade — arch-topped frames along a garden wall."
		/>
		<div class="gallery-grid" use:reveal>
			{#each GALLERY as photo, i (i)}
				{#if i % 3 === 1}
					<figure class="g-frame arch" class:tall={photo.tall} use:cornerIvy={{ seed: 60 + i }}>
						<button
							class="g-hit"
							onclick={() => openAt(i)}
							aria-label="View photo: {photo.caption}"
							style={photo.src ? '' : `background:${TONES[photo.tone]}`}
						>
							{#if photo.src}
								<img src={photo.src} alt={photo.caption} loading="lazy" />
							{:else}
								<span class="photo-note">photo {String(i + 1).padStart(2, '0')}</span>
							{/if}
						</button>
						<figcaption class="g-caption"><i>{photo.caption}</i></figcaption>
					</figure>
				{:else}
					<figure class="g-frame arch" class:tall={photo.tall}>
						<button
							class="g-hit"
							onclick={() => openAt(i)}
							aria-label="View photo: {photo.caption}"
							style={photo.src ? '' : `background:${TONES[photo.tone]}`}
						>
							{#if photo.src}
								<img src={photo.src} alt={photo.caption} loading="lazy" />
							{:else}
								<span class="photo-note">photo {String(i + 1).padStart(2, '0')}</span>
							{/if}
						</button>
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
	}
	.g-frame:nth-child(3n + 2) {
		margin-bottom: 4rem;
	}
	.g-frame:nth-child(3n) {
		margin-bottom: 3rem;
	}
	.g-frame {
		aspect-ratio: 3 / 3.9;
	}
	.g-frame.tall {
		aspect-ratio: 3 / 4.4;
	}
	.g-hit {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: inherit;
		background: transparent;
	}
	.g-hit img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.8s ease;
	}
	.g-hit:hover img {
		transform: scale(1.02);
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
		color: var(--ink-faint);
		font-size: 0.88rem;
	}
	.lightbox {
		background: rgba(20, 14, 11, 0.94);
		border: none;
		max-width: 100vw;
		max-height: 100vh;
		width: 100vw;
		height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
	}
	.lightbox:not([open]) {
		display: none;
	}
	.lightbox img {
		max-width: min(92vw, 1100px);
		max-height: 80vh;
		object-fit: contain;
		border: 1px solid rgba(230, 217, 198, 0.3);
	}
	.lightbox p {
		color: var(--ink-muted);
		font-family: var(--body);
		margin: 1rem 0 0;
	}
</style>
