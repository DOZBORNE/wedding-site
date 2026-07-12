<script lang="ts">
	// An illustrated wax seal — irregular pressed edge, squeeze ridge, drip,
	// recessed stamp face and embossed monogram. Drawn as code, unique
	// gradient ids per instance so several seals can share a page.
	import { COUPLE } from '$lib/config';
	let { size = 76 }: { size?: number } = $props();
	const uid = Math.random().toString(36).slice(2, 8);
	const mono = `${COUPLE.monogram[0]}${COUPLE.monogram[1]}`;
</script>

<svg
	class="seal"
	width={size}
	height={size}
	viewBox="0 0 120 120"
	aria-hidden="true"
	style="--s:{size}px"
>
	<defs>
		<radialGradient id="wax-{uid}" cx="0.38" cy="0.3" r="0.85">
			<stop offset="0" stop-color="#8A3540" />
			<stop offset="0.45" stop-color="#5A1B23" />
			<stop offset="0.8" stop-color="#381015" />
			<stop offset="1" stop-color="#25090d" />
		</radialGradient>
		<radialGradient id="face-{uid}" cx="0.42" cy="0.36" r="0.8">
			<stop offset="0" stop-color="#6B2530" />
			<stop offset="0.7" stop-color="#451419" />
			<stop offset="1" stop-color="#310d12" />
		</radialGradient>
		<filter id="rough-{uid}" x="-10%" y="-10%" width="120%" height="120%">
			<feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7" result="n" />
			<feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
		</filter>
	</defs>

	<!-- the wax itself: pressed blob with uneven spread -->
	<g filter="url(#rough-{uid})">
		<path
			d="M60 8
			   C74 6 83 13 91 19
			   C100 26 112 31 113 43
			   C114 53 106 61 108 70
			   C110 81 117 91 108 99
			   C100 107 88 103 78 108
			   C69 113 58 117 49 112
			   C41 108 30 112 22 105
			   C13 98 17 87 12 78
			   C7 69 4 57 9 48
			   C14 39 24 36 31 28
			   C39 20 47 10 60 8 Z"
			fill="url(#wax-{uid})"
		/>
		<!-- a drip that escaped the press -->
		<path
			d="M20 98 C14 104 15 113 21 114 C27 115 30 108 27 103 C25 100 22 99 20 98 Z"
			fill="url(#wax-{uid})"
		/>
	</g>

	<!-- squeeze ridge around the stamped face -->
	<circle cx="60" cy="60" r="39" fill="none" stroke="#8A3540" stroke-width="3.5" opacity="0.55" />
	<circle cx="60" cy="60" r="42" fill="none" stroke="#20080b" stroke-width="1.6" opacity="0.5" />

	<!-- recessed stamp face -->
	<circle cx="60" cy="60" r="35" fill="url(#face-{uid})" />
	<!-- inset shading: shadow upper-left, light lower-right -->
	<path
		d="M31 45 A35 35 0 0 1 75 27"
		fill="none"
		stroke="rgba(16,4,6,0.55)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	<path
		d="M90 72 A35 35 0 0 1 45 92"
		fill="none"
		stroke="rgba(240,222,196,0.22)"
		stroke-width="2.4"
		stroke-linecap="round"
	/>

	<!-- engraved border ring inside the face -->
	<circle
		cx="60"
		cy="60"
		r="28.5"
		fill="none"
		stroke="rgba(240,222,196,0.42)"
		stroke-width="1"
		stroke-dasharray="1.5 3.5"
	/>

	<!-- monogram in raised relief: cream where the light catches, shadow beneath -->
	<g
		font-family="Didot, 'Bodoni 72', 'Bodoni Moda', Georgia, serif"
		font-style="italic"
		font-size="30"
		text-anchor="middle"
	>
		<text x="60.5" y="71.6" fill="rgba(16,4,6,0.65)">{mono}</text>
		<text x="60" y="70" fill="#EDDFC6" opacity="0.95">{mono}</text>
	</g>
	<!-- tiny fleuron beneath -->
	<text x="60" y="84" text-anchor="middle" font-size="8" fill="rgba(240,222,196,0.55)">❦</text>

	<!-- specular highlights where the wax still shines -->
	<ellipse cx="41" cy="29" rx="13" ry="6.5" fill="#fff" opacity="0.13" transform="rotate(-24 41 29)" />
	<ellipse cx="37" cy="26" rx="5" ry="2.6" fill="#fff" opacity="0.2" transform="rotate(-24 37 26)" />
	<ellipse cx="97" cy="86" rx="6" ry="2.4" fill="#fff" opacity="0.08" transform="rotate(32 97 86)" />
</svg>

<style>
	.seal {
		display: block;
		filter: drop-shadow(0 calc(var(--s) / 12) calc(var(--s) / 5) rgba(0, 0, 0, 0.5));
		user-select: none;
	}
</style>
