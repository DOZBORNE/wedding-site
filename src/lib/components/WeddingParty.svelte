<script lang="ts">
	import { WEDDING_PARTY, TONES } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';

	const sides = [
		{ label: 'Her side', people: WEDDING_PARTY.bridesmaids },
		{ label: 'His side', people: WEDDING_PARTY.groomsmen }
	];
</script>

<section class="block party" id="party">
	<div class="wrap">
		<SectionHead
			eyebrow="The wedding party"
			title="Our favorite people"
			seed={14}
			lede="The ones standing beside us — statuary for the colonnade."
		/>
		{#each sides as side (side.label)}
			<div class="side" use:reveal>
				<div class="side-label">{side.label}</div>
				<div class="row">
					{#each side.people as person, i (i)}
						<figure class="member">
							<div
								class="portrait arch"
								style={person.src ? '' : `background:${TONES[person.tone] ?? TONES.olive}`}
							>
								{#if person.src}
									<img src={person.src} alt={person.name} loading="lazy" />
								{:else}
									<span class="photo-note">portrait</span>
								{/if}
							</div>
							<figcaption>
								<b>{person.name}</b>
								<i>{person.role}</i>
							</figcaption>
						</figure>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.party {
		background: linear-gradient(180deg, var(--espresso), #251a18 50%, var(--espresso));
	}
	.side {
		margin-bottom: 3rem;
	}
	.side-label {
		text-align: center;
		font-family: var(--display);
		font-style: italic;
		font-size: 1.3rem;
		color: var(--blush);
		margin-bottom: 1.6rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 200px));
		justify-content: center;
		gap: clamp(1.2rem, 3vw, 2.2rem);
	}
	.member {
		margin: 0;
		display: grid;
		gap: 0.7rem;
		justify-items: center;
	}
	.portrait {
		width: 100%;
		aspect-ratio: 3 / 3.8;
		border: 1px solid rgba(230, 217, 198, 0.28);
		outline: 1px solid rgba(230, 217, 198, 0.09);
		outline-offset: 5px;
		display: grid;
		place-items: center;
		overflow: hidden;
		position: relative;
		box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4);
	}
	.portrait img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo-note {
		font-size: 0.6rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: rgba(230, 217, 198, 0.5);
	}
	figcaption {
		text-align: center;
		display: grid;
		gap: 0.1rem;
	}
	figcaption b {
		font-weight: 400;
		font-family: var(--display);
		font-size: 1.05rem;
		color: var(--parchment);
	}
	figcaption i {
		font-size: 0.78rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--ink-faint);
		font-style: normal;
	}
</style>
