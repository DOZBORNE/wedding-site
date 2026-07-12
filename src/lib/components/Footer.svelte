<script lang="ts">
	import { COUPLE, VENUE, WEDDING } from '$lib/config';
</script>

<footer class="site">
	<div class="mono">{COUPLE.monogram[0]}<i>&amp;</i>{COUPLE.monogram[1]}</div>
	<div class="ornament"><span>❦</span></div>
	<p>see you at the wedding — {VENUE.name}, {VENUE.shortAddress}</p>
	<p class="dim">{WEDDING.dateLabel} · {COUPLE.hashtag}</p>
</footer>

<style>
	.site {
		border-top: 1px solid var(--line);
		padding: 4rem 1rem 5rem;
		text-align: center;
		display: grid;
		gap: 0.9rem;
		justify-items: center;
		background: linear-gradient(180deg, var(--espresso), #1b1410);
	}
	.mono {
		font-family: var(--display);
		font-size: 2rem;
		color: var(--parchment);
	}
	.mono i {
		font-style: italic;
		color: var(--blush);
		font-size: 0.6em;
		vertical-align: 0.4em;
	}
	p {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
		font-size: 0.95rem;
	}
	.dim {
		opacity: 0.65;
	}
</style>
