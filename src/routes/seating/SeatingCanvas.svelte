<script lang="ts">
	import { CHAIR_DEPTH_FEET, CHAIR_WIDTH_FEET, chairPlacements } from '$lib/pavilion/chairs';
	import { isZone } from '$lib/pavilion/catalog';
	import { DEFAULT_SPACING } from '$lib/pavilion/spacing';
	import {
		GUEST_DRAG_TYPE,
		capacityOf,
		isSeatable,
		partyHue
	} from '$lib/pavilion/seating';
	import type { PlanItem, SeatGuest, TableSeating } from '$lib/pavilion/types';
	import PlanItemShape from './PlanItemShape.svelte';
	import VenuePlan from './VenuePlan.svelte';

	interface Props {
		items: PlanItem[];
		numbered: { item: PlanItem; number: number }[];
		tables: Record<string, TableSeating>;
		guestsById: Map<string, SeatGuest>;
		noChair: ReadonlySet<string>;
		selectedTableId: string | null;
		focusPartyId: string | null;
		placing: boolean;
		onpick: (tableId: string | null) => void;
		onhover: (tableId: string | null) => void;
		ondropguests: (tableId: string, guestIds: string[]) => void;
	}

	let {
		items,
		numbered,
		tables,
		guestsById,
		noChair,
		selectedTableId,
		focusPartyId,
		placing,
		onpick,
		onhover,
		ondropguests
	}: Props = $props();

	let hoverTableId = $state<string | null>(null);

	const scenery = $derived(
		items.filter((item) => !isSeatable(item)).sort((a, b) => Number(isZone(b)) - Number(isZone(a)))
	);

	const drawn = $derived(
		numbered.map(({ item, number }) => {
			const seating = tables[item.id];
			const capacity = capacityOf(item, seating);
			const seated = (seating?.guests ?? [])
				.map((id) => guestsById.get(id))
				.filter((guest): guest is SeatGuest => Boolean(guest));
			const inChairs = seated.filter((guest) => !noChair.has(guest.id));
			const onLaps = seated.length - inChairs.length;
			// Draw every booked chair, even past capacity, so an overfull table shows it.
			const chairs = chairPlacements({ ...item, seats: Math.max(capacity, inChairs.length) });
			const gone = seated.some((guest) => guest.attending === false);
			return {
				item,
				number,
				name: seating?.name ?? '',
				capacity,
				filled: inChairs.length,
				onLaps,
				over: inChairs.length > capacity,
				gone,
				parties: new Set(seated.map((guest) => guest.partyId)),
				chairs: chairs.map((chair, index) => ({ ...chair, guest: inChairs[index] ?? null, extra: index >= capacity }))
			};
		})
	);

	/** Hovering a party only dims the room once that party is sitting somewhere. */
	const focusSeated = $derived(
		focusPartyId !== null && drawn.some((table) => table.parties.has(focusPartyId!))
	);

	function readDrag(event: DragEvent): string[] {
		try {
			const ids = JSON.parse(event.dataTransfer?.getData(GUEST_DRAG_TYPE) || '[]');
			return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
		} catch {
			return [];
		}
	}

	function handleDragOver(event: DragEvent, tableId: string) {
		if (!event.dataTransfer?.types.includes(GUEST_DRAG_TYPE)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		hoverTableId = tableId;
	}

	function handleDrop(event: DragEvent, tableId: string) {
		event.preventDefault();
		hoverTableId = null;
		const ids = readDrag(event);
		if (ids.length) ondropguests(tableId, ids);
	}
</script>

<svg
	class="plan seating-plan"
	class:placing
	viewBox="-23 -29 103 79"
	role="application"
	aria-label="The pavilion plan with each guest table and who is sitting at it"
	onpointerdown={(event) => {
		if (!(event.target as Element | null)?.closest('[data-table-id]')) onpick(null);
	}}
>
	<VenuePlan showBays={false} showDimensions={false} />

	{#each scenery as item (item.id)}
		<g class="item scenery" transform="translate({item.x} {item.y}) rotate({item.rotationDegrees})">
			<PlanItemShape
				{item}
				spacing={DEFAULT_SPACING}
				selected={false}
				showGuestZone={false}
				showLane={false}
				showChairs={false}
			/>
		</g>
	{/each}

	{#each drawn as table (table.item.id)}
		{@const radius = table.item.widthFeet / 2}
		<g
			class="seat-table"
			class:selected={table.item.id === selectedTableId}
			class:over={table.over}
			class:full={!table.over && table.filled === table.capacity}
			class:gone={table.gone}
			class:drop-hover={hoverTableId === table.item.id}
			class:dimmed={focusSeated && !table.parties.has(focusPartyId!)}
			data-table-id={table.item.id}
			transform="translate({table.item.x} {table.item.y}) rotate({table.item.rotationDegrees})"
			role="button"
			tabindex="0"
			aria-label="Table {table.number}{table.name ? `, ${table.name}` : ''}: {table.filled} of {table.capacity} chairs filled"
			onclick={() => onpick(table.item.id)}
			onpointerenter={() => onhover(table.item.id)}
			onpointerleave={() => onhover(null)}
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onpick(table.item.id);
				}
			}}
			ondragover={(event) => handleDragOver(event, table.item.id)}
			ondragleave={(event) => {
				// dragleave also fires moving between a table's own chairs and top.
				if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
				if (hoverTableId === table.item.id) hoverTableId = null;
			}}
			ondrop={(event) => handleDrop(event, table.item.id)}
		>
			<!-- One steady target per table, the size of the table with its chairs. -->
			{#if table.item.shape === 'round'}
				<circle class="seat-hit" r={radius + CHAIR_DEPTH_FEET} />
				<circle class="drop-ring" r={radius + CHAIR_DEPTH_FEET + 0.4} />
			{:else}
				<rect
					class="seat-hit"
					x={-table.item.widthFeet / 2 - CHAIR_DEPTH_FEET}
					y={-table.item.depthFeet / 2 - CHAIR_DEPTH_FEET}
					width={table.item.widthFeet + CHAIR_DEPTH_FEET * 2}
					height={table.item.depthFeet + CHAIR_DEPTH_FEET * 2}
					rx="0.6"
				/>
				<rect
					class="drop-ring"
					x={-table.item.widthFeet / 2 - CHAIR_DEPTH_FEET - 0.4}
					y={-table.item.depthFeet / 2 - CHAIR_DEPTH_FEET - 0.4}
					width={table.item.widthFeet + CHAIR_DEPTH_FEET * 2 + 0.8}
					height={table.item.depthFeet + CHAIR_DEPTH_FEET * 2 + 0.8}
					rx="0.8"
				/>
			{/if}

			{#each table.chairs as chair, index (index)}
				<rect
					class="seat-chair"
					class:taken={chair.guest !== null}
					class:awaiting={chair.guest?.attending === null}
					class:extra={chair.extra}
					class:focus={chair.guest !== null && chair.guest.partyId === focusPartyId}
					style:--hue={chair.guest ? partyHue(chair.guest.partyId) : null}
					x={-CHAIR_WIDTH_FEET / 2}
					y={-CHAIR_DEPTH_FEET / 2}
					width={CHAIR_WIDTH_FEET}
					height={CHAIR_DEPTH_FEET}
					rx="0.32"
					transform="translate({chair.x} {chair.y}) rotate({chair.rotation})"
				/>
			{/each}

			{#if table.item.shape === 'round'}
				<circle class="seat-top" r={radius} />
			{:else}
				<rect
					class="seat-top"
					x={-table.item.widthFeet / 2}
					y={-table.item.depthFeet / 2}
					width={table.item.widthFeet}
					height={table.item.depthFeet}
					rx="0.25"
				/>
			{/if}

			<g transform="rotate({-table.item.rotationDegrees})">
				<text class="seat-number" y={table.onLaps ? -0.25 : 0.15}>{table.number}</text>
				<text class="seat-count" y={table.onLaps ? 1.15 : 1.75}>{table.filled}/{table.capacity}</text>
				{#if table.onLaps}
					<text class="seat-count lap" y="2.15">+{table.onLaps} on lap</text>
				{/if}
			</g>
		</g>
	{/each}
</svg>
