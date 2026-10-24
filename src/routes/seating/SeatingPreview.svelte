<script lang="ts">
	import { isZone } from '$lib/pavilion/catalog';
	import { capacityOf, chairsFilled, guestLabel, partyHue } from '$lib/pavilion/seating';
	import { PAVILION, surfaceAt } from '$lib/pavilion/venue';
	import type { PlanItem, SeatGuest, TableSeating } from '$lib/pavilion/types';

	interface Props {
		chartName: string;
		planName: string;
		items: PlanItem[];
		numbered: { item: PlanItem; number: number }[];
		tables: Record<string, TableSeating>;
		guestsById: Map<string, SeatGuest>;
		noChair: ReadonlySet<string>;
		unseated: SeatGuest[];
		onclose: () => void;
		onprint: () => void;
	}

	let {
		chartName,
		planName,
		items,
		numbered,
		tables,
		guestsById,
		noChair,
		unseated,
		onclose,
		onprint
	}: Props = $props();

	/** The pavilion read as a grid of column bays, so cards keep the room's left-to-right order. */
	const COLUMNS = 5;
	const BAY_FEET = PAVILION.width / COLUMNS;
	/** Tables whose centres are this close in depth sit in the same row. */
	const ROW_TOLERANCE_FEET = 5;

	const shortName = (guest: SeatGuest) => guestLabel(guest).replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '');

	interface Card {
		id: string;
		number: number;
		name: string;
		capacity: number;
		filled: number;
		guests: SeatGuest[];
	}

	function cardFor(item: PlanItem, number: number): Card {
		const seating = tables[item.id];
		const guests = (seating?.guests ?? [])
			.map((id) => guestsById.get(id))
			.filter((guest): guest is SeatGuest => Boolean(guest));
		return {
			id: item.id,
			number,
			name: seating?.name ?? '',
			capacity: capacityOf(item, seating),
			filled: chairsFilled(guests.map((guest) => guest.id), noChair),
			guests
		};
	}

	const bayOf = (x: number) => Math.min(COLUMNS - 1, Math.max(0, Math.floor(x / BAY_FEET)));

	/** Pavilion tables bunched into rows by depth, each placed in the bay its centre falls in. */
	const pavilionRows = $derived.by(() => {
		const inside = numbered
			.filter(({ item }) => surfaceAt(item.x, item.y) === 'pavilion')
			.sort((a, b) => a.item.y - b.item.y);
		const rows: { y: number; entries: typeof inside }[] = [];
		for (const entry of inside) {
			const row = rows.at(-1);
			if (row && entry.item.y - row.y <= ROW_TOLERANCE_FEET) row.entries.push(entry);
			else rows.push({ y: entry.item.y, entries: [entry] });
		}
		return rows.map((row) => {
			const cells: (Card | null)[] = Array(COLUMNS).fill(null);
			for (const { item, number } of [...row.entries].sort((a, b) => a.item.x - b.item.x)) {
				// Two tables in one bay: take the next free one rather than hide either.
				let bay = bayOf(item.x);
				while (cells[bay] && bay < COLUMNS - 1) bay += 1;
				while (cells[bay] && bay > 0) bay -= 1;
				cells[bay] = cardFor(item, number);
			}
			const top = row.y - ROW_TOLERANCE_FEET;
			const bottom = row.y + ROW_TOLERANCE_FEET;
			return {
				cells: cells.map((card, bay) => {
					if (card) return { card, label: '' };
					// Say what's on the floor where there's no table, e.g. the dance floor.
					const zone = items.find(
						(item) =>
							isZone(item) &&
							item.category !== 'circulation' &&
							bayOf(item.x) === bay &&
							item.y + item.depthFeet / 2 >= top &&
							item.y - item.depthFeet / 2 <= bottom
					);
					return { card: null, label: zone?.label ?? '' };
				})
			};
		});
	});

	const elsewhere = $derived(
		(['patio', 'grounds'] as const)
			.map((surface) => ({
				surface,
				cards: numbered
					.filter(({ item }) => surfaceAt(item.x, item.y) === surface)
					.sort((a, b) => a.item.y - b.item.y)
					.map(({ item, number }) => cardFor(item, number))
			}))
			.filter((group) => group.cards.length)
	);

	const seatedCount = $derived(
		numbered.reduce((sum, { item }) => sum + cardFor(item, 0).guests.length, 0)
	);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onclose();
	}}
/>

{#snippet tableCard(card: Card)}
	<article class="preview-card" class:over={card.filled > card.capacity} class:empty={!card.guests.length}>
		<header>
			<span class="preview-number">{card.number}</span>
			<span class="preview-table-name">{card.name}</span>
			<span class="preview-fill">{card.filled}/{card.capacity}</span>
		</header>
		{#if card.guests.length}
			<ul>
				{#each card.guests as guest (guest.id)}
					<li style:--hue={partyHue(guest.partyId)} class:gone={guest.attending !== true}>
						<span class="party-swatch"></span>
						<span class="preview-name">{shortName(guest)}</span>
						{#if noChair.has(guest.id)}<span class="preview-tag">lap</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="preview-none">Nobody yet</p>
		{/if}
	</article>
{/snippet}

<div class="preview" role="dialog" aria-modal="true" aria-label="Seating preview">
	<div class="preview-bar">
		<div class="preview-title">
			<h2>{chartName}</h2>
			<p>{seatedCount} seated at {numbered.length} tables · {planName}</p>
		</div>
		<div class="preview-actions">
			<button class="button" type="button" onclick={onprint}>Print</button>
			<button class="button primary" type="button" onclick={onclose}>Close <kbd>Esc</kbd></button>
		</div>
	</div>

	<div class="preview-room">
		<section class="preview-zone pavilion">
			<h3>Pavilion <small>amphitheater side at the top</small></h3>
			<div class="preview-grid" style:--columns={COLUMNS}>
				{#each pavilionRows as row, rowIndex (rowIndex)}
					{#each row.cells as cell, bay (bay)}
						{#if cell.card}
							{@render tableCard(cell.card)}
						{:else}
							<div class="preview-gap">{cell.label}</div>
						{/if}
					{/each}
				{/each}
			</div>
		</section>

		{#each elsewhere as group (group.surface)}
			<section class="preview-zone {group.surface}">
				<h3>{group.surface === 'patio' ? 'Patio' : 'Grounds'}</h3>
				<div class="preview-stack">
					{#each group.cards as card (card.id)}
						{@render tableCard(card)}
					{/each}
				</div>
			</section>
		{/each}
	</div>

	{#if unseated.length}
		<section class="preview-unseated">
			<h3>Not seated yet <small>{unseated.length}</small></h3>
			<p>
				{#each unseated as guest, index (guest.id)}
					<span style:--hue={partyHue(guest.partyId)}><span class="party-swatch"></span>{shortName(guest)}</span>{index < unseated.length - 1 ? ' ' : ''}
				{/each}
			</p>
		</section>
	{/if}
</div>
