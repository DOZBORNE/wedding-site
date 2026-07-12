<script lang="ts">
	// The turn of the page: an engraved vignette of Aldridge Gardens at dusk —
	// the lake, the pavilion, the hydrangeas — drawn in cream line-work.
	import { VENUE } from '$lib/config';
	import { reveal } from '$lib/reveal';

	const fireflies = [
		{ x: 150, y: 240, d: 0 },
		{ x: 290, y: 205, d: 1.3 },
		{ x: 445, y: 250, d: 2.1 },
		{ x: 585, y: 215, d: 0.7 },
		{ x: 690, y: 260, d: 2.8 },
		{ x: 830, y: 230, d: 1.7 },
		{ x: 985, y: 250, d: 0.4 },
		{ x: 1080, y: 210, d: 2.4 }
	];
</script>

<section class="setting" use:reveal>
	<div class="eyebrow">The setting · <a href={VENUE.url} target="_blank" rel="noopener">{VENUE.name}</a></div>
	<p class="line">
		thirty acres of hydrangeas and quiet water — vows at the lake's edge, dinner &amp; dancing in
		the pavilion
	</p>

	<svg class="vignette" viewBox="0 0 1200 420" role="img" aria-label="An engraving of Aldridge Gardens: a lake at dusk with the pavilion on the far bank, hydrangeas in the foreground">
		<defs>
			<radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stop-color="rgba(232,220,200,0.5)" />
				<stop offset="1" stop-color="rgba(232,220,200,0)" />
			</radialGradient>
			<radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
				<stop offset="0" stop-color="rgba(227,184,127,0.55)" />
				<stop offset="1" stop-color="rgba(227,184,127,0)" />
			</radialGradient>
		</defs>

		<!-- moon -->
		<circle cx="330" cy="86" r="70" fill="url(#moonGlow)" />
		<circle cx="330" cy="86" r="26" fill="none" stroke="rgba(232,220,200,0.75)" stroke-width="1.4" />
		<path d="M318 74 A26 26 0 0 1 352 96" fill="none" stroke="rgba(232,220,200,0.3)" stroke-width="1" />

		<!-- far treeline -->
		<path
			d="M0 190 Q 60 150 120 178 Q 170 130 240 168 Q 300 140 360 172 Q 430 138 500 170 Q 560 148 620 172 Q 690 142 760 170 Q 820 150 880 172 Q 950 144 1020 170 Q 1090 150 1200 176 L 1200 232 L 0 232 Z"
			fill="#26301E"
			stroke="rgba(232,220,200,0.14)"
			stroke-width="1"
		/>
		<!-- near treeline -->
		<path
			d="M0 214 Q 80 178 160 204 Q 240 172 320 202 Q 420 176 520 206 Q 600 182 680 206 Q 780 180 880 208 Q 960 186 1040 208 Q 1120 190 1200 210 L 1200 250 L 0 250 Z"
			fill="#2F3B25"
			stroke="rgba(232,220,200,0.18)"
			stroke-width="1"
		/>

		<!-- the pavilion on the far bank -->
		<g stroke="rgba(232,220,200,0.85)" stroke-width="1.5" fill="none">
			<ellipse cx="985" cy="180" rx="46" ry="26" fill="url(#lampGlow)" stroke="none" />
			<!-- roof -->
			<path d="M925 176 Q 985 138 1045 176" />
			<path d="M933 176 Q 985 146 1037 176" stroke-width="1" opacity="0.6" />
			<line x1="985" y1="147" x2="985" y2="138" />
			<circle cx="985" cy="135" r="2.5" />
			<!-- columns -->
			<line x1="936" y1="176" x2="936" y2="222" />
			<line x1="962" y1="176" x2="962" y2="224" />
			<line x1="1008" y1="176" x2="1008" y2="224" />
			<line x1="1034" y1="176" x2="1034" y2="222" />
			<!-- capitals & bases -->
			<line x1="932" y1="178" x2="940" y2="178" stroke-width="1" />
			<line x1="958" y1="178" x2="966" y2="178" stroke-width="1" />
			<line x1="1004" y1="178" x2="1012" y2="178" stroke-width="1" />
			<line x1="1030" y1="178" x2="1038" y2="178" stroke-width="1" />
			<!-- platform -->
			<line x1="922" y1="224" x2="1048" y2="224" />
			<line x1="928" y1="230" x2="1042" y2="230" stroke-width="1" opacity="0.7" />
		</g>

		<!-- lake -->
		<path d="M0 250 L 1200 250 L 1200 420 L 0 420 Z" fill="#222B26" />
		<g stroke="rgba(232,220,200,0.22)" stroke-width="1" fill="none">
			<path d="M60 278 Q 160 272 260 278 T 460 278" />
			<path d="M540 296 Q 660 289 780 296 T 1000 296" />
			<path d="M140 322 Q 260 315 380 322 T 620 322" />
			<path d="M700 336 Q 800 330 900 336 T 1100 336" />
			<path d="M40 366 Q 180 358 320 366 T 600 366" />
			<path d="M760 382 Q 880 375 1000 382 T 1180 382" />
		</g>
		<!-- moon & lamp reflections -->
		<g stroke-width="1.6" fill="none">
			<path d="M300 266 h56 M312 284 h34 M306 306 h44 M318 330 h24" stroke="rgba(232,220,200,0.3)" />
			<path d="M958 262 h54 M972 280 h30 M964 300 h42" stroke="rgba(227,184,127,0.35)" />
		</g>

		<!-- foreground hydrangeas, left bank -->
		<g>
			<g fill="#3E4A31">
				<ellipse cx="72" cy="392" rx="66" ry="30" />
				<ellipse cx="150" cy="404" rx="60" ry="26" />
			</g>
			{#each [{ cx: 60, cy: 372, r: 17, c: '#6A4A50' }, { cx: 92, cy: 360, r: 14, c: '#C99F94' }, { cx: 124, cy: 374, r: 16, c: '#8B907F' }, { cx: 156, cy: 384, r: 13, c: '#6A4A50' }, { cx: 36, cy: 386, r: 12, c: '#C99F94' }] as bloom (bloom.cx)}
				<g>
					<circle cx={bloom.cx} cy={bloom.cy} r={bloom.r} fill={bloom.c} opacity="0.85" />
					<circle cx={bloom.cx - bloom.r * 0.3} cy={bloom.cy - bloom.r * 0.3} r={bloom.r * 0.32} fill="rgba(232,220,200,0.28)" />
					<circle cx={bloom.cx + bloom.r * 0.35} cy={bloom.cy + bloom.r * 0.15} r={bloom.r * 0.26} fill="rgba(34,26,20,0.25)" />
				</g>
			{/each}
		</g>
		<!-- foreground hydrangeas, right corner -->
		<g>
			<ellipse cx="1150" cy="400" rx="70" ry="28" fill="#3E4A31" />
			{#each [{ cx: 1120, cy: 378, r: 15, c: '#C99F94' }, { cx: 1152, cy: 368, r: 17, c: '#6A4A50' }, { cx: 1184, cy: 380, r: 13, c: '#8B907F' }] as bloom (bloom.cx)}
				<g>
					<circle cx={bloom.cx} cy={bloom.cy} r={bloom.r} fill={bloom.c} opacity="0.85" />
					<circle cx={bloom.cx - bloom.r * 0.3} cy={bloom.cy - bloom.r * 0.3} r={bloom.r * 0.32} fill="rgba(232,220,200,0.28)" />
				</g>
			{/each}
		</g>

		<!-- fireflies -->
		{#each fireflies as fly (fly.x)}
			<circle class="firefly" cx={fly.x} cy={fly.y} r="2" style="animation-delay:{fly.d}s" />
		{/each}
	</svg>

	<p class="addr">
		{VENUE.address} · ceremony &amp; reception in one place ·
		<a href={VENUE.directionsUrl} target="_blank" rel="noopener">directions</a>
	</p>
</section>

<style>
	.setting {
		padding: clamp(4rem, 8vw, 6rem) 0 0;
		text-align: center;
		background: linear-gradient(180deg, var(--espresso), var(--claret) 60%, var(--espresso));
		display: grid;
		gap: 1.1rem;
		justify-items: center;
		overflow: hidden;
	}
	.eyebrow a {
		color: var(--candle);
		text-decoration: none;
	}
	.eyebrow a:hover {
		text-decoration: underline;
	}
	.line {
		font-family: var(--display);
		font-style: italic;
		font-size: clamp(1.4rem, 3.2vw, 2.1rem);
		line-height: 1.35;
		color: var(--blush);
		max-width: 34ch;
		margin: 0;
		padding: 0 1.5rem;
	}
	.vignette {
		width: min(1200px, 100%);
		height: auto;
		display: block;
		margin-top: 1rem;
	}
	.firefly {
		fill: var(--candle);
		animation: flicker 3.2s ease-in-out infinite;
	}
	@keyframes flicker {
		0%,
		100% {
			opacity: 0;
		}
		45% {
			opacity: 0.9;
		}
		60% {
			opacity: 0.25;
		}
		75% {
			opacity: 0.7;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.firefly {
			opacity: 0.5;
		}
	}
	.addr {
		margin: 0;
		padding: 1.2rem 1.5rem 1.6rem;
		width: 100%;
		font-style: italic;
		color: var(--ink-muted);
		font-size: 0.98rem;
		background: #1e2420;
		border-top: 1px solid rgba(232, 220, 200, 0.1);
	}
	.addr a {
		color: var(--candle);
	}
</style>
