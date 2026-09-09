<script lang="ts">
	import { isZone } from '$lib/pavilion/catalog';
	import type { ConflictReport, PlanItem, SpacingRule } from '$lib/pavilion/types';
	import PlanItemShape from './PlanItemShape.svelte';
	import VenuePlan from './VenuePlan.svelte';

	interface Display {
		guestZone: boolean;
		lane: boolean;
		chairs: boolean;
		bays: boolean;
		dimensions: boolean;
	}

	interface Props {
		items: PlanItem[];
		spacing: SpacingRule;
		conflicts: ConflictReport;
		selectedId: string | null;
		display: Display;
		onselect: (id: string | null) => void;
		onchange: (items: PlanItem[]) => void;
		oncommit: () => void;
	}

	let { items, spacing, conflicts, selectedId, display, onselect, onchange, oncommit }: Props =
		$props();

	const SNAP_FEET = 0.5;
	const MINIMUM_ZONE_FEET = 3;

	let plan: SVGSVGElement;

	type Drag =
		| { mode: 'move'; id: string; grabOffsetX: number; grabOffsetY: number }
		| { mode: 'resize'; id: string; corner: string; anchorX: number; anchorY: number };

	let drag = $state<Drag | null>(null);

	/** Zones sit under the tables so a table is always the thing you grab. */
	const drawOrder = $derived(
		[...items].sort((a, b) => Number(isZone(b)) - Number(isZone(a)))
	);

	function planPoint(event: PointerEvent): { x: number; y: number } {
		const matrix = plan.getScreenCTM();
		if (!matrix) return { x: 0, y: 0 };
		const point = plan.createSVGPoint();
		point.x = event.clientX;
		point.y = event.clientY;
		const mapped = point.matrixTransform(matrix.inverse());
		return { x: mapped.x, y: mapped.y };
	}

	function snap(value: number, free: boolean): number {
		return free ? Math.round(value * 100) / 100 : Math.round(value / SNAP_FEET) * SNAP_FEET;
	}

	function update(id: string, patch: Partial<PlanItem>) {
		onchange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	}

	function handlePointerDown(event: PointerEvent) {
		const target = event.target as Element | null;
		const handleNode = target?.closest('.resize-handle');
		const itemNode = target?.closest('[data-item-id]');

		if (!itemNode) {
			onselect(null);
			return;
		}

		const id = itemNode.getAttribute('data-item-id');
		const item = items.find((candidate) => candidate.id === id);
		if (!item || !id) return;

		onselect(id);
		const origin = planPoint(event);

		if (handleNode) {
			const corner = handleNode.getAttribute('data-handle') ?? 'se';
			drag = {
				mode: 'resize',
				id,
				corner,
				anchorX: item.x + (corner.includes('w') ? 1 : -1) * (item.widthFeet / 2),
				anchorY: item.y + (corner.includes('n') ? 1 : -1) * (item.depthFeet / 2)
			};
		} else {
			drag = {
				mode: 'move',
				id,
				grabOffsetX: origin.x - item.x,
				grabOffsetY: origin.y - item.y
			};
		}

		plan.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!drag) return;
		const point = planPoint(event);
		const free = event.altKey;

		if (drag.mode === 'move') {
			update(drag.id, {
				x: snap(point.x - drag.grabOffsetX, free),
				y: snap(point.y - drag.grabOffsetY, free)
			});
			return;
		}

		const width = Math.max(MINIMUM_ZONE_FEET, Math.abs(snap(point.x, free) - drag.anchorX));
		const depth = Math.max(MINIMUM_ZONE_FEET, Math.abs(snap(point.y, free) - drag.anchorY));
		update(drag.id, {
			widthFeet: width,
			depthFeet: depth,
			x: drag.anchorX + (drag.corner.includes('w') ? -1 : 1) * (width / 2),
			y: drag.anchorY + (drag.corner.includes('n') ? -1 : 1) * (depth / 2)
		});
	}

	function endDrag(event: PointerEvent) {
		if (!drag) return;
		drag = null;
		if (plan.hasPointerCapture(event.pointerId)) plan.releasePointerCapture(event.pointerId);
		oncommit();
	}
</script>

<svg
	bind:this={plan}
	class="plan"
	viewBox="-23 -29 103 79"
	role="application"
	aria-label="Scale plan of the Aldridge Gardens pavilion and patio with movable tables"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={endDrag}
	onpointercancel={endDrag}
>
	<VenuePlan showBays={display.bays} showDimensions={display.dimensions} />

	{#each drawOrder as item (item.id)}
		<g
			class="item"
			class:flagged={conflicts.flaggedIds.has(item.id)}
			class:dragging={drag?.id === item.id}
			data-item-id={item.id}
			transform="translate({item.x} {item.y}) rotate({item.rotationDegrees})"
		>
			<PlanItemShape
				{item}
				{spacing}
				selected={item.id === selectedId}
				showGuestZone={display.guestZone}
				showLane={display.lane}
				showChairs={display.chairs}
			/>
		</g>
	{/each}

	{#each conflicts.pinchLines as pinch, index (index)}
		<line class="pinch-line" x1={pinch.fromX} y1={pinch.fromY} x2={pinch.toX} y2={pinch.toY} />
		<text
			class="pinch-text"
			x={(pinch.fromX + pinch.toX) / 2}
			y={(pinch.fromY + pinch.toY) / 2 + 0.5}>{pinch.caption}</text
		>
	{/each}
</svg>
