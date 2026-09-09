<script lang="ts">
	import { CHAIR_DEPTH_FEET, CHAIR_WIDTH_FEET, chairPlacements } from '$lib/pavilion/chairs';
	import { isZone } from '$lib/pavilion/catalog';
	import { laneShare } from '$lib/pavilion/spacing';
	import type { PlanItem, SpacingRule } from '$lib/pavilion/types';

	interface Props {
		item: PlanItem;
		spacing: SpacingRule;
		selected: boolean;
		showGuestZone: boolean;
		showLane: boolean;
		showChairs: boolean;
	}

	let { item, spacing, selected, showGuestZone, showLane, showChairs }: Props = $props();

	const zone = $derived(isZone(item));
	const seated = $derived(!zone && item.seats > 0);
	const chairs = $derived(showChairs ? chairPlacements(item) : []);
	const guestMargin = $derived(spacing.seatedGuestFeet);
	const laneMargin = $derived(spacing.seatedGuestFeet + laneShare(spacing));

	/** Rounds grow as circles; rectangles grow as rounded rectangles. */
	const ringFor = (margin: number) => ({
		radius: item.widthFeet / 2 + margin,
		x: -item.widthFeet / 2 - margin,
		y: -item.depthFeet / 2 - margin,
		width: item.widthFeet + margin * 2,
		height: item.depthFeet + margin * 2,
		corner: margin + 0.3
	});

	const laneRing = $derived(ringFor(laneMargin));
	const guestRing = $derived(ringFor(guestMargin));
	const selectionRing = $derived(ringFor(0.9));

	const caption = $derived(zone ? item.label.toUpperCase() : item.seats > 0 ? String(item.seats) : item.label);

	const handles = [
		{ name: 'nw', towardX: -1, towardY: -1 },
		{ name: 'ne', towardX: 1, towardY: -1 },
		{ name: 'se', towardX: 1, towardY: 1 },
		{ name: 'sw', towardX: -1, towardY: 1 }
	] as const;
</script>

{#if seated && showLane}
	{#if item.shape === 'round'}
		<circle class="lane-zone" cx="0" cy="0" r={laneRing.radius} />
	{:else}
		<rect
			class="lane-zone"
			x={laneRing.x}
			y={laneRing.y}
			width={laneRing.width}
			height={laneRing.height}
			rx={laneRing.corner}
		/>
	{/if}
{/if}

{#if seated && showGuestZone}
	{#if item.shape === 'round'}
		<circle class="guest-zone" cx="0" cy="0" r={guestRing.radius} />
	{:else}
		<rect
			class="guest-zone"
			x={guestRing.x}
			y={guestRing.y}
			width={guestRing.width}
			height={guestRing.height}
			rx={guestRing.corner}
		/>
	{/if}
{/if}

{#each chairs as chair, index (index)}
	<rect
		class="chair"
		x={-CHAIR_WIDTH_FEET / 2}
		y={-CHAIR_DEPTH_FEET / 2}
		width={CHAIR_WIDTH_FEET}
		height={CHAIR_DEPTH_FEET}
		rx="0.32"
		transform="translate({chair.x} {chair.y}) rotate({chair.rotation})"
	/>
{/each}

{#if item.shape === 'round'}
	<circle class="body body-{item.category}" cx="0" cy="0" r={item.widthFeet / 2} />
{:else}
	<rect
		class="body body-{item.category}"
		x={-item.widthFeet / 2}
		y={-item.depthFeet / 2}
		width={item.widthFeet}
		height={item.depthFeet}
		rx={zone ? 0.4 : 0.25}
	/>
{/if}

{#if caption}
	<text
		class="item-label label-{item.category}"
		x="0"
		y={zone ? 0.8 : 0.6}
		transform="rotate({-item.rotationDegrees})">{caption}</text
	>
{/if}

<!-- A generous grab target, so thin banquet tables pick up as easily as a round -->
<rect
	class="hit"
	x={-item.widthFeet / 2 - 0.6}
	y={-item.depthFeet / 2 - 0.6}
	width={item.widthFeet + 1.2}
	height={item.depthFeet + 1.2}
/>

{#if selected}
	{#if item.shape === 'round'}
		<circle class="selection-ring" cx="0" cy="0" r={selectionRing.radius} />
	{:else}
		<rect
			class="selection-ring"
			x={selectionRing.x}
			y={selectionRing.y}
			width={selectionRing.width}
			height={selectionRing.height}
			rx="0.5"
		/>
	{/if}
	{#if zone}
		{#each handles as handle (handle.name)}
			<rect
				class="resize-handle {handle.name}"
				data-handle={handle.name}
				x={handle.towardX * (item.widthFeet / 2 + 0.9) - 0.85}
				y={handle.towardY * (item.depthFeet / 2 + 0.9) - 0.85}
				width="1.7"
				height="1.7"
				rx="0.3"
			/>
		{/each}
	{/if}
{/if}
