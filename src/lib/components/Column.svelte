<script lang="ts">
	// Cream-stone Ionic column, engraved as code — crisp at any size.
	let { class: cls = '' }: { class?: string } = $props();
	const uid = `stone-${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg class="col {cls}" viewBox="0 0 80 460" aria-hidden="true">
	<defs>
		<linearGradient id={uid} x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#B3A283" />
			<stop offset="0.42" stop-color="#E5D7BC" />
			<stop offset="1" stop-color="#A69575" />
		</linearGradient>
	</defs>
	<g stroke="rgba(58,36,32,0.55)" stroke-width="1">
		<rect x="4" y="6" width="72" height="9" fill="#D5C5A7" />
		<rect x="12" y="15" width="56" height="18" fill="url(#{uid})" />
		<g fill="none">
			<circle cx="15" cy="26" r="10.5" /><circle cx="15" cy="26" r="6" />
			<circle cx="15" cy="26" r="2.5" fill="rgba(58,36,32,0.45)" />
			<circle cx="65" cy="26" r="10.5" /><circle cx="65" cy="26" r="6" />
			<circle cx="65" cy="26" r="2.5" fill="rgba(58,36,32,0.45)" />
		</g>
		<rect x="18" y="33" width="44" height="7" fill="#C4B394" />
		<rect x="22" y="40" width="36" height="5" fill="#D5C5A7" />
		<rect x="21" y="45" width="38" height="360" fill="url(#{uid})" />
		<g stroke="rgba(58,36,32,0.4)">
			<line x1="29" y1="49" x2="29" y2="401" /><line x1="37" y1="49" x2="37" y2="401" />
			<line x1="45" y1="49" x2="45" y2="401" /><line x1="53" y1="49" x2="53" y2="401" />
		</g>
		<g stroke="rgba(255,248,235,0.5)">
			<line x1="31" y1="49" x2="31" y2="401" /><line x1="39" y1="49" x2="39" y2="401" />
			<line x1="47" y1="49" x2="47" y2="401" /><line x1="55" y1="49" x2="55" y2="401" />
		</g>
		<rect x="17" y="405" width="46" height="8" fill="#D5C5A7" />
		<rect x="11" y="413" width="58" height="10" fill="url(#{uid})" />
		<rect x="5" y="423" width="70" height="12" fill="#C4B394" />
		<rect x="1" y="435" width="78" height="10" fill="#D5C5A7" />
	</g>
</svg>

<style>
	.col {
		aspect-ratio: 80 / 460;
		height: auto;
		flex: none;
		filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.5));
	}
</style>
