<script lang="ts">
	import {
		COLUMN_POSITIONS_ACROSS,
		COLUMN_POSITIONS_DOWN,
		COLUMN_SIZE_FEET,
		OUTLETS,
		PAVILION,
		PATIO,
		SOUND_JACKS,
		columnPosts
	} from '$lib/pavilion/venue';

	let { showBays = true, showDimensions = true }: { showBays?: boolean; showDimensions?: boolean } =
		$props();

	const posts = columnPosts();
	const bayLinesAcross = COLUMN_POSITIONS_ACROSS.slice(1, -1);
	const bayLinesDown = COLUMN_POSITIONS_DOWN.slice(1, -1);
	const amphitheaterSteps = Array.from({ length: 5 }, (_unused, index) => -15.2 + index * 1.35);
	const scaleTicks = [60, 65, 70];
</script>

<!-- Lawn under everything -->
<rect class="surface-lawn" x="-23" y="-29" width="103" height="79" />

<!-- Amphitheater tiers and its centre steps -->
<path class="amphitheater-arc" d="M 6 -9.2 A 46 46 0 0 1 54 -9.2" />
<path class="amphitheater-arc" d="M 10 -4.6 A 40 40 0 0 1 50 -4.6" />
{#each amphitheaterSteps as stepY (stepY)}
	<line class="amphitheater-step" x1="27.8" x2="32.2" y1={stepY} y2={stepY} />
{/each}
<text class="place-label" x="30" y="-18.6" text-anchor="middle">Amphitheater</text>

<!-- Kitchen and rest rooms -->
<path class="surface-structure" d="M -17 -22 L 0 -22 L 0 9 L -9 9 A 8 8 0 0 0 -17 1 Z" />
<text class="place-label on-structure" x="-8.5" y="-11.5" text-anchor="middle">Kitchen</text>
<text class="place-label on-structure" x="-8.5" y="-8" text-anchor="middle">Rest rooms</text>

<!-- Patio, ramp, then the pavilion slab over them -->
<rect
	class="surface-patio"
	x={PATIO.x}
	y={PATIO.y}
	width={PATIO.width}
	height={PATIO.depth}
/>
<rect class="surface-ramp" x="24" y="40" width="11" height="5" />
<text class="place-label" x="29.5" y="47.4" text-anchor="middle">Ramp</text>
<rect
	class="surface-pavilion"
	x={PAVILION.x}
	y={PAVILION.y}
	width={PAVILION.width}
	height={PAVILION.depth}
/>
<text class="place-label" x="68.5" y="44.4" text-anchor="middle">Patio</text>

{#if showBays}
	<g class="bay-grid-group">
		{#each bayLinesAcross as x (x)}
			<line class="bay-grid" x1={x} x2={x} y1="1" y2="39" />
		{/each}
		{#each bayLinesDown as y (y)}
			<line class="bay-grid" x1="1" x2="59" y1={y} y2={y} />
		{/each}
	</g>
{/if}

{#each posts as post (`${post.x}:${post.y}`)}
	<rect
		class="column-post"
		x={post.x - COLUMN_SIZE_FEET / 2}
		y={post.y - COLUMN_SIZE_FEET / 2}
		width={COLUMN_SIZE_FEET}
		height={COLUMN_SIZE_FEET}
	/>
{/each}

{#if showDimensions}
	<!-- Power outlets and sound jacks, as marked on the venue drawing -->
	{#each OUTLETS as [x, y] (`${x}:${y}`)}
		<circle class="service-mark-fill" cx={x} cy={y} r="0.85" />
		<line class="service-mark" x1={x - 0.85} x2={x + 0.85} y1={y} y2={y} />
		<line class="service-mark" x1={x} x2={x} y1={y - 0.85} y2={y + 0.85} />
	{/each}
	{#each SOUND_JACKS as [x, y] (`${x}:${y}`)}
		<circle class="service-mark-fill" cx={x} cy={y} r="0.95" />
		<text class="dimension-text jack" x={x} y={y + 0.62} text-anchor="middle">S</text>
	{/each}

	<!-- Dimension lines, drafting style -->
	<line class="dimension-line" x1="0" x2="60" y1="-25" y2="-25" />
	<line class="dimension-line" x1="0" x2="0" y1="-26.1" y2="-23.9" />
	<line class="dimension-line" x1="60" x2="60" y1="-26.1" y2="-23.9" />
	<text class="dimension-text" x="30" y="-26.5" text-anchor="middle">60′ ±</text>

	<line class="dimension-line" x1="60" x2="77" y1="-25" y2="-25" />
	<line class="dimension-line" x1="77" x2="77" y1="-26.1" y2="-23.9" />
	<text class="dimension-text" x="68.5" y="-26.5" text-anchor="middle">17′ ±</text>

	<line class="dimension-line" x1="-20" x2="-20" y1="0" y2="40" />
	<line class="dimension-line" x1="-21.1" x2="-18.9" y1="0" y2="0" />
	<line class="dimension-line" x1="-21.1" x2="-18.9" y1="40" y2="40" />
	<text
		class="dimension-text"
		x="-21.4"
		y="20"
		text-anchor="middle"
		transform="rotate(-90 -21.4 20)">40′ ±</text
	>

	<!-- Scale bar -->
	<line class="dimension-line" x1="60" x2="70" y1="47.5" y2="47.5" />
	{#each scaleTicks as x (x)}
		<line class="dimension-line" x1={x} x2={x} y1="46.6" y2="48.4" />
	{/each}
	<text class="dimension-text" x="71.4" y="48.2">10 ft</text>
{/if}
