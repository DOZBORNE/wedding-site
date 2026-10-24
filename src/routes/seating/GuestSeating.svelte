<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import {
		GUEST_DRAG_TYPE,
		MAX_TABLE_CAPACITY,
		NO_CHAIR_BY_DEFAULT,
		autoFill,
		blankTable,
		capacityOf,
		chairsFilled,
		dietaryNote,
		groupByParty,
		guestLabel,
		numberedTables,
		partyHue,
		seatGuests,
		swapTables,
		tableOfGuest,
		type PartyGroup
	} from '$lib/pavilion/seating';
	import type { SavedPlan, SeatGuest, SeatingChart, TableSeating } from '$lib/pavilion/types';
	import SeatingCanvas from './SeatingCanvas.svelte';

	interface Props {
		plans: SavedPlan[];
		/** Owned by the page, so switching to Tables and back keeps what was saved. */
		charts: SeatingChart[];
		guests: SeatGuest[];
		canDelete: boolean;
		chartsUnavailable: boolean;
		guestsUnavailable: boolean;
		masthead: Snippet;
	}

	let {
		plans,
		charts = $bindable(),
		guests,
		canDelete,
		chartsUnavailable,
		guestsUnavailable,
		masthead
	}: Props = $props();

	const ACTIVE_KEY = 'aldridge.seating.activeChart.v1';
	const SAVE_DELAY_MS = 700;

	/* ---- charts ------------------------------------------------------------ */

	const guestsById = $derived(new Map(guests.map((guest) => [guest.id, guest])));

	/** The open chart, minus anyone deleted from /admin since it was saved. */
	function workingCopy(chart: SeatingChart | undefined) {
		const known = (id: string) => guestsById.has(id);
		return {
			tables: Object.fromEntries(
				Object.entries($state.snapshot(chart?.tables ?? {})).map(([id, seating]) => [
					id,
					{ ...seating, guests: seating.guests.filter(known) }
				])
			) as Record<string, TableSeating>,
			noChair: (chart?.noChair ?? []).filter(known)
		};
	}

	const first = untrack(() => workingCopy(charts[0]));
	let activeId = $state<string | null>(untrack(() => charts[0]?.id ?? null));
	// Always replaced, never mutated, so there is no need to proxy every snapshot.
	let tables = $state.raw<Record<string, TableSeating>>(first.tables);
	let noChairIds = $state.raw<string[]>(first.noChair);
	let chartName = $state(untrack(() => charts[0]?.name ?? ''));
	let history = $state.raw<{ tables: Record<string, TableSeating>; noChair: string[] }[]>([]);
	/** Where "New chart" came from, so it can be cancelled. */
	let returnToId = $state<string | null>(null);

	type SaveState = 'saved' | 'pending' | 'saving' | 'conflict' | 'error';
	let saveState = $state<SaveState>('saved');
	let theirs = $state<SeatingChart | null>(null);

	/*
	 * Saving: every edit drops the open chart's whole state into an outbox keyed
	 * by chart id, and one sender drains it a request at a time. Each request's
	 * updatedAt comes from that chart's entry in `charts`, which every successful
	 * save refreshes, so switching charts mid-save neither loses the edit nor
	 * mistakes our own earlier save for someone else's.
	 */
	type Outgoing = { name: string; tables: Record<string, TableSeating>; noChair: string[]; overwrite?: string };
	const outbox = new Map<string, Outgoing>();
	let sending = false;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	const active = $derived(charts.find((chart) => chart.id === activeId) ?? null);
	const plan = $derived(active ? (plans.find((candidate) => candidate.id === active.planId) ?? null) : null);
	const items = $derived(plan?.items ?? []);

	const officialPlan = $derived(
		plans.find((candidate) => /official/i.test(candidate.name)) ?? plans[0] ?? null
	);
	let newPlanId = $state(untrack(() => officialPlan?.id ?? ''));
	let newName = $state('');
	let creating = $state(false);
	let confirmingDelete = $state(false);

	function loadChart(chart: SeatingChart | null) {
		flush();
		const copy = workingCopy(chart ?? undefined);
		activeId = chart?.id ?? null;
		tables = copy.tables;
		noChairIds = copy.noChair;
		chartName = chart?.name ?? '';
		history = [];
		selectedTableId = null;
		pending = null;
		confirmingDelete = false;
		saveState = 'saved';
		theirs = null;
		try {
			if (chart) localStorage.setItem(ACTIVE_KEY, chart.id);
		} catch {
			// Remembering the open chart is a convenience only.
		}
	}

	onMount(() => {
		let remembered: string | null = null;
		try {
			remembered = localStorage.getItem(ACTIVE_KEY);
		} catch {
			// Fall through to the newest chart.
		}
		loadChart(charts.find((chart) => chart.id === remembered) ?? charts[0] ?? null);
		refreshActive();

		const warn = (event: BeforeUnloadEvent) => {
			if (outbox.size || sending || saveState === 'conflict' || saveState === 'error') event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => {
			window.removeEventListener('beforeunload', warn);
			// Leaving for the Tables view: send anything still waiting.
			flush();
		};
	});

	/** Pick up anything saved from another browser since this page loaded, if nothing here is waiting to save. */
	async function refreshActive() {
		const id = activeId;
		if (!id) return;
		const response = await fetch(`/api/seating/charts?id=${encodeURIComponent(id)}`).catch(() => null);
		const body = await response?.json().catch(() => null);
		const fresh: SeatingChart | undefined = body?.chart;
		const known = charts.find((chart) => chart.id === id);
		if (!fresh || !known || fresh.updatedAt === known.updatedAt) return;
		if (id !== activeId || outbox.size || sending || history.length) return;
		charts = charts.map((chart) => (chart.id === id ? fresh : chart));
		loadChart(fresh);
	}

	function scheduleSave() {
		if (!activeId) return;
		outbox.set(activeId, { name: chartName, tables, noChair: noChairIds });
		if (saveState !== 'conflict') saveState = 'pending';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(flush, SAVE_DELAY_MS);
	}

	async function flush() {
		clearTimeout(saveTimer);
		if (sending) return;
		sending = true;
		try {
			while (outbox.size) {
				const [id, outgoing] = outbox.entries().next().value!;
				outbox.delete(id);
				const base = outgoing.overwrite ?? charts.find((chart) => chart.id === id)?.updatedAt;
				if (!base) continue;
				// Someone else's version is on screen for this chart; don't keep hitting it.
				if (id === activeId && saveState === 'conflict' && !outgoing.overwrite) continue;
				if (id === activeId) saveState = 'saving';

				let response: Response;
				let body: { chart?: SeatingChart; error?: string } | null;
				try {
					response = await fetch('/api/seating/charts', {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ id, ...outgoing, updatedAt: base })
					});
					body = await response.json().catch(() => null);
				} catch {
					if (!outbox.has(id)) outbox.set(id, outgoing);
					if (id === activeId) saveState = 'error';
					return;
				}

				if (response.status === 409 && body?.chart) {
					if (id === activeId) {
						theirs = body.chart;
						saveState = 'conflict';
					} else {
						showToast(`“${outgoing.name}” was changed elsewhere — your last edit to it didn't save`);
					}
					continue;
				}
				if (!response.ok || !body?.chart) {
					if (id === activeId) {
						saveState = 'error';
						showToast(body?.error ?? 'Could not save the chart.');
					}
					continue;
				}
				const saved = body.chart;
				charts = charts.map((chart) => (chart.id === saved.id ? saved : chart));
				if (id === activeId) {
					theirs = null;
					saveState = outbox.has(id) ? 'pending' : 'saved';
				}
			}
		} finally {
			sending = false;
		}
	}

	function takeTheirs() {
		if (!theirs) return;
		const chart = theirs;
		outbox.delete(chart.id);
		charts = charts.map((candidate) => (candidate.id === chart.id ? chart : candidate));
		loadChart(chart);
		showToast('Loaded the other version');
	}

	function keepMine() {
		if (!activeId || !theirs) return;
		outbox.set(activeId, { name: chartName, tables, noChair: noChairIds, overwrite: theirs.updatedAt });
		saveState = 'pending';
		flush();
	}

	function retrySave() {
		scheduleSave();
		flush();
	}

	function startNewChart() {
		returnToId = activeId;
		loadChart(null);
	}

	async function createChart(source: 'blank' | 'copy') {
		const planId = source === 'copy' && active ? active.planId : newPlanId;
		if (!planId) {
			showToast('Save a table layout first, then seat people on it.');
			return;
		}
		const name =
			source === 'copy' && active
				? `${chartName} (copy)`.slice(0, 60)
				: newName.trim() || `Seating ${charts.length + 1}`;
		const seeded = guests.filter((guest) => NO_CHAIR_BY_DEFAULT.includes(guest.name.trim())).map((g) => g.id);
		creating = true;
		try {
			const response = await fetch('/api/seating/charts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					planId,
					tables: source === 'copy' ? tables : {},
					noChair: source === 'copy' ? noChairIds : seeded
				})
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || !body?.chart) {
				showToast(body?.error ?? 'Could not create the chart.');
				return;
			}
			charts = [body.chart, ...charts];
			loadChart(body.chart);
			newName = '';
			returnToId = null;
			showToast(source === 'copy' ? `Copied to “${name}”` : `Started “${name}”`);
		} catch {
			showToast('Could not reach the server.');
		} finally {
			creating = false;
		}
	}

	async function deleteChart() {
		if (!active) return;
		if (!confirmingDelete) {
			confirmingDelete = true;
			return;
		}
		const doomed = active;
		const response = await fetch(`/api/seating/charts?id=${encodeURIComponent(doomed.id)}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			confirmingDelete = false;
			showToast(body?.error ?? 'Could not delete that chart.');
			return;
		}
		outbox.delete(doomed.id);
		charts = charts.filter((chart) => chart.id !== doomed.id);
		loadChart(charts[0] ?? null);
		showToast(`Deleted “${doomed.name}”`);
	}

	/* ---- who is coming and where they sit ---------------------------------- */

	const coming = $derived(guests.filter((guest) => guest.attending === true));
	/** A party of one needs no "party" line under the name — it would just repeat it. */
	const partySize = $derived(
		guests.reduce((sizes, guest) => sizes.set(guest.partyId, (sizes.get(guest.partyId) ?? 0) + 1), new Map<string, number>())
	);

	/** The grey line under a name in the table popover: party, dietary note, and whether they're still coming. */
	const rosterDetail = (guest: SeatGuest) =>
		[
			(partySize.get(guest.partyId) ?? 0) > 1 ? guest.partyName : '',
			dietaryNote(guest),
			guest.attending !== true ? 'not coming' : ''
		]
			.filter(Boolean)
			.join(' · ');
	const noChair = $derived(new Set(noChairIds));
	const where = $derived(tableOfGuest(tables));
	const numbered = $derived(numberedTables(items));
	const numberOf = $derived(new Map(numbered.map(({ item, number }) => [item.id, number])));

	const tableTitle = (tableId: string) => {
		const name = tables[tableId]?.name;
		const number = numberOf.get(tableId);
		return name ? `${number} · ${name}` : `Table ${number}`;
	};

	const chairsNeeded = $derived(chairsFilled(coming.map((guest) => guest.id), noChair));
	const seatedCount = $derived(coming.filter((guest) => where.has(guest.id)).length);
	const totalChairs = $derived(numbered.reduce((sum, { item }) => sum + capacityOf(item, tables[item.id]), 0));

	const tableStats = $derived(
		numbered.map(({ item, number }) => {
			const seated = (tables[item.id]?.guests ?? []).filter((id) => guestsById.has(id));
			return {
				id: item.id,
				number,
				capacity: capacityOf(item, tables[item.id]),
				filled: chairsFilled(seated, noChair)
			};
		})
	);
	const overTables = $derived(tableStats.filter((table) => table.filled > table.capacity));

	/** People a chart still seats who have since said they're not coming. */
	const noLongerComing = $derived(
		[...where.keys()]
			.map((id) => guestsById.get(id))
			.filter((guest): guest is SeatGuest => Boolean(guest) && guest!.attending !== true)
	);

	const splitParties = $derived(
		groupByParty(coming)
			.map((party) => ({
				party,
				at: [...new Set(party.guests.map((guest) => where.get(guest.id)).filter(Boolean))] as string[]
			}))
			.filter(({ at }) => at.length > 1)
	);

	/* ---- the party list ---------------------------------------------------- */

	let listView = $state<'unseated' | 'all'>('unseated');
	let search = $state('');
	let focusPartyId = $state<string | null>(null);

	const parties = $derived.by(() => {
		const query = search.trim().toLowerCase();
		const pool = listView === 'unseated' ? coming.filter((guest) => !where.has(guest.id)) : coming;
		return groupByParty(pool)
			.filter(
				(party) =>
					!query ||
					party.partyName.toLowerCase().includes(query) ||
					party.guests.some((guest) => guest.name.toLowerCase().includes(query))
			)
			.sort(
				(a, b) =>
					chairsFilled(b.guests.map((g) => g.id), noChair) - chairsFilled(a.guests.map((g) => g.id), noChair) ||
					a.partyName.localeCompare(b.partyName)
			);
	});
	const unseatedCount = $derived(coming.length - seatedCount);

	/** "Mr. Mark Connally" reads as "Mark Connally" on a chip. */
	const shortName = (guest: SeatGuest) =>
		guestLabel(guest).replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '');

	/* ---- placing people ---------------------------------------------------- */

	type Pending = { guestIds: string[]; label: string };
	let pending = $state<Pending | null>(null);
	let selectedTableId = $state<string | null>(null);

	function remember() {
		history = [...history.slice(-59), { tables, noChair: noChairIds }];
	}

	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		history = history.slice(0, -1);
		tables = previous.tables;
		noChairIds = previous.noChair;
		scheduleSave();
	}

	function place(guestIds: string[], tableId: string | null) {
		if (!guestIds.length) return;
		remember();
		tables = seatGuests(tables, guestIds, tableId);
		pending = null;
		// The card being dragged may vanish from the list before its pointerleave fires.
		focusPartyId = null;
		scheduleSave();

		const who = guestIds.length === 1 ? shortName(guestsById.get(guestIds[0])!) : `${guestIds.length} guests`;
		if (!tableId) {
			showToast(`Unseated ${who}`);
			return;
		}
		const stats = tableStats.find((table) => table.id === tableId);
		const filled = chairsFilled(tables[tableId].guests.filter((id) => guestsById.has(id)), noChair);
		showToast(
			stats && filled > stats.capacity
				? `${who} → ${tableTitle(tableId)} — now ${filled} in ${stats.capacity} chairs`
				: `${who} → ${tableTitle(tableId)}`
		);
	}

	function activateOnKey(event: KeyboardEvent, action: () => void) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		action();
	}

	function pickParty(party: PartyGroup) {
		const ids = party.guests.map((guest) => guest.id);
		pending =
			pending && pending.guestIds.join() === ids.join()
				? null
				: { guestIds: ids, label: party.partyName };
	}

	function pickGuest(guest: SeatGuest) {
		pending =
			pending && pending.guestIds.length === 1 && pending.guestIds[0] === guest.id
				? null
				: { guestIds: [guest.id], label: shortName(guest) };
	}

	function pickTable(tableId: string | null) {
		if (tableId && pending) {
			place(pending.guestIds, tableId);
			selectedTableId = tableId;
			return;
		}
		selectedTableId = tableId === selectedTableId ? null : tableId;
	}

	function startDrag(event: DragEvent, guestIds: string[]) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData(GUEST_DRAG_TYPE, JSON.stringify(guestIds));
		event.dataTransfer.effectAllowed = 'move';
		event.stopPropagation();
	}

	let listDropHover = $state(false);

	function dropOnList(event: DragEvent) {
		event.preventDefault();
		listDropHover = false;
		try {
			const ids = JSON.parse(event.dataTransfer?.getData(GUEST_DRAG_TYPE) || '[]');
			if (Array.isArray(ids)) place(ids.filter((id) => where.has(id)), null);
		} catch {
			// Not ours.
		}
	}

	function runAutoFill() {
		const before = unseatedCount;
		const result = autoFill(items, tables, coming, noChair);
		if (!result.seated) {
			showToast(before ? 'No unseated party fits whole at any table' : 'Everyone already has a seat');
			return;
		}
		remember();
		tables = result.tables;
		scheduleSave();
		showToast(
			result.leftOver
				? `Seated ${result.seated} — ${result.leftOver} still need a table with room`
				: `Seated ${result.seated} — everyone has a seat`
		);
	}

	function clearAll() {
		remember();
		tables = Object.fromEntries(
			Object.entries(tables).map(([id, seating]) => [id, { ...seating, guests: [] }])
		);
		selectedTableId = null;
		scheduleSave();
		showToast('Everyone unseated — table names and sizes kept');
	}

	/* ---- the table drawer -------------------------------------------------- */

	const drawerItem = $derived(numbered.find(({ item }) => item.id === selectedTableId)?.item ?? null);
	const drawerSeating = $derived(selectedTableId ? (tables[selectedTableId] ?? blankTable()) : null);
	const drawerGuests = $derived(
		(drawerSeating?.guests ?? [])
			.map((id) => guestsById.get(id))
			.filter((guest): guest is SeatGuest => Boolean(guest))
	);
	const drawerCapacity = $derived(drawerItem ? capacityOf(drawerItem, drawerSeating ?? undefined) : 0);
	const drawerFilled = $derived(chairsFilled(drawerGuests.map((guest) => guest.id), noChair));

	function patchTable(tableId: string, patch: Partial<TableSeating>, record = true) {
		if (record) remember();
		tables = { ...tables, [tableId]: { ...(tables[tableId] ?? blankTable()), ...patch } };
		scheduleSave();
	}

	function setCapacity(next: number) {
		if (!drawerItem || !selectedTableId) return;
		const clamped = Math.min(MAX_TABLE_CAPACITY, Math.max(1, next));
		patchTable(selectedTableId, { capacity: clamped === drawerItem.seats ? null : clamped });
	}

	function moveInTable(guestId: string, step: -1 | 1) {
		if (!selectedTableId || !drawerSeating) return;
		const order = [...drawerSeating.guests];
		const from = order.indexOf(guestId);
		const to = from + step;
		if (from < 0 || to < 0 || to >= order.length) return;
		[order[from], order[to]] = [order[to], order[from]];
		patchTable(selectedTableId, { guests: order });
	}

	function toggleNoChair(guestId: string) {
		remember();
		noChairIds = noChair.has(guestId)
			? noChairIds.filter((id) => id !== guestId)
			: [...noChairIds, guestId];
		scheduleSave();
	}

	/* ---- popovers beside the table ----------------------------------------- */

	const POPOVER_WIDTH = 320;
	const PEEK_WIDTH = 240;
	const POPOVER_GAP = 12;

	let holder = $state<HTMLDivElement>();
	let hoverTableId = $state<string | null>(null);
	let drawerHeight = $state(0);
	let peekHeight = $state(0);
	let layoutTick = $state(0);

	$effect(() => {
		if (!holder) return;
		const observer = new ResizeObserver(() => (layoutTick += 1));
		observer.observe(holder);
		return () => observer.disconnect();
	});

	/**
	 * Beside the table rather than over it: to its right when there's room, else
	 * its left, nudged up or down to stay inside the plan. The map keeps its size.
	 */
	function besideTable(tableId: string | null, width: number, height: number, _tick: number) {
		if (!holder || !tableId) return null;
		const node = holder.querySelector(`[data-table-id="${CSS.escape(tableId)}"]`);
		if (!node) return null;
		const frame = holder.getBoundingClientRect();
		const table = node.getBoundingClientRect();
		const x = table.left - frame.left + holder.scrollLeft;
		const y = table.top - frame.top + holder.scrollTop;
		const fitsRight = x + table.width + POPOVER_GAP + width <= holder.scrollLeft + holder.clientWidth - 8;
		const left = fitsRight ? x + table.width + POPOVER_GAP : Math.max(8, x - POPOVER_GAP - width);
		const lowest = holder.scrollTop + holder.clientHeight - height - 8;
		const top = Math.max(holder.scrollTop + 8, Math.min(y + table.height / 2 - 60, lowest));
		return { left, top };
	}

	const drawerAt = $derived(besideTable(selectedTableId, POPOVER_WIDTH, drawerHeight, layoutTick));
	const peekTableId = $derived(hoverTableId && hoverTableId !== selectedTableId ? hoverTableId : null);
	const peekAt = $derived(besideTable(peekTableId, PEEK_WIDTH, peekHeight, layoutTick));
	const peekGuests = $derived(
		(peekTableId ? (tables[peekTableId]?.guests ?? []) : [])
			.map((id) => guestsById.get(id))
			.filter((guest): guest is SeatGuest => Boolean(guest))
	);
	const peekStats = $derived(tableStats.find((table) => table.id === peekTableId) ?? null);

	let swapWith = $state('');

	$effect(() => {
		void selectedTableId;
		swapWith = '';
	});

	function swapSelected() {
		if (!selectedTableId || !swapWith || swapWith === selectedTableId) return;
		const message = `Swapped ${tableTitle(selectedTableId)} and ${tableTitle(swapWith)}`;
		remember();
		tables = swapTables(tables, selectedTableId, swapWith);
		scheduleSave();
		showToast(message);
		selectedTableId = swapWith;
		swapWith = '';
	}

	/* ---- export ------------------------------------------------------------ */

	function exportCsv() {
		// Guests typed the dietary notes; a leading = + - @ would run as a spreadsheet formula.
		const cell = (value: string | number) => {
			const text = String(value);
			return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
		};
		const rows: (string | number)[][] = [['Table', 'Table name', 'Guest', 'Party', 'Age', 'Dietary', 'Chair']];
		for (const { item, number } of numbered) {
			for (const id of tables[item.id]?.guests ?? []) {
				const guest = guestsById.get(id);
				if (!guest) continue;
				rows.push([
					number,
					tables[item.id]?.name ?? '',
					guestLabel(guest),
					guest.partyName,
					guest.ageGroup,
					dietaryNote(guest),
					noChair.has(id) ? 'no' : 'yes'
				]);
			}
		}
		for (const guest of coming.filter((g) => !where.has(g.id))) {
			rows.push(['', 'Unseated', guestLabel(guest), guest.partyName, guest.ageGroup, dietaryNote(guest), noChair.has(guest.id) ? 'no' : 'yes']);
		}
		const blob = new Blob([rows.map((row) => row.map(cell).join(',')).join('\n')], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `${(chartName || 'seating').replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}

	/* ---- toast and keys ---------------------------------------------------- */

	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string) {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2800);
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.matches('input, textarea, select')) return;
		if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			undo();
		} else if (event.key === 'Escape') {
			pending = null;
			selectedTableId = null;
		}
	}

	const saveLabel: Record<SaveState, string> = {
		saved: 'Saved',
		pending: 'Unsaved changes',
		saving: 'Saving…',
		conflict: 'Changed elsewhere',
		error: 'Not saved'
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<aside class="rail">
	{@render masthead()}

	<div class="rail-scroll">
		{#if chartsUnavailable}
			<p class="empty-note">
				Seating charts aren't set up in the database yet. Run
				<code>sql/2026-10-23-seating-charts.sql</code> in the Supabase SQL editor, then reload.
			</p>
		{:else if guestsUnavailable}
			<p class="empty-note">
				The guest list couldn't be loaded, so seating is paused to keep it from looking empty. Reload
				to try again.
			</p>
		{:else if !active}
			<section class="section">
				<h2 class="section-heading">Start a seating chart</h2>
				<p class="empty-note">
					Pick the table layout to seat people on. You can make as many charts on one layout as you
					like and compare them.
				</p>
				<select class="field" bind:value={newPlanId}>
					{#each plans as option (option.id)}
						<option value={option.id}>{option.name} — {option.seats} seats</option>
					{/each}
				</select>
				<input class="field" type="text" placeholder="Name this chart" maxlength="60" bind:value={newName} />
				<div class="button-row">
					{#if returnToId && charts.some((chart) => chart.id === returnToId)}
						<button class="button" type="button" onclick={() => loadChart(charts.find((chart) => chart.id === returnToId) ?? null)}>
							Cancel
						</button>
					{/if}
					<button class="button primary" type="button" disabled={creating || !plans.length} onclick={() => createChart('blank')}>
						{creating ? 'Starting…' : 'Start chart'}
					</button>
				</div>
			</section>
		{:else}
			<section class="section">
				<div class="chart-head">
					<select
						class="field chart-picker"
						aria-label="Open a seating chart"
						value={activeId}
						onchange={(event) => loadChart(charts.find((chart) => chart.id === event.currentTarget.value) ?? null)}
					>
						{#each charts as chart (chart.id)}
							<option value={chart.id}>{chart.name}</option>
						{/each}
					</select>
					<span class="save-state {saveState}" role="status">{saveLabel[saveState]}</span>
				</div>
				<input
					class="field"
					type="text"
					aria-label="Chart name"
					maxlength="60"
					bind:value={chartName}
					oninput={scheduleSave}
				/>
				<p class="chart-plan">
					On <b>{plan?.name ?? 'a layout that was deleted'}</b>
					{#if officialPlan && plan && plan.id !== officialPlan.id}
						<span class="off-plan">— not {officialPlan.name}</span>
					{/if}
				</p>
				{#if saveState === 'conflict'}
					<div class="conflict-banner">
						<p>Someone else saved this chart after you opened it.</p>
						<div class="button-row">
							<button class="button" type="button" onclick={takeTheirs}>Load theirs</button>
							<button class="button" type="button" onclick={keepMine}>Keep mine</button>
						</div>
					</div>
				{:else if saveState === 'error'}
					<div class="conflict-banner">
						<p>The last change didn't save.</p>
						<button class="button" type="button" onclick={retrySave}>Try again</button>
					</div>
				{/if}
				<div class="button-row">
					<button class="button" type="button" disabled={creating} onclick={() => createChart('copy')}>Duplicate</button>
					<button class="button" type="button" onclick={startNewChart}>New chart</button>
					{#if canDelete}
						<button class="button danger" class:armed={confirmingDelete} type="button" onclick={deleteChart} onblur={() => (confirmingDelete = false)}>
							{confirmingDelete ? 'Really delete?' : 'Delete'}
						</button>
					{/if}
				</div>
			</section>

			<section class="section">
				<dl class="tally">
					<div><dt>Seated</dt><dd>{seatedCount}<small>/{coming.length}</small></dd></div>
					<div class:flagged={chairsNeeded > totalChairs}>
						<dt>Chairs</dt><dd>{chairsNeeded}<small>/{totalChairs}</small></dd>
					</div>
					<div class:flagged={overTables.length > 0}><dt>Over</dt><dd>{overTables.length}</dd></div>
				</dl>
				{#if chairsNeeded > totalChairs}
					<p class="derived warn">
						{chairsNeeded - totalChairs} more {chairsNeeded - totalChairs === 1 ? 'chair' : 'chairs'} needed
						than the tables hold. Raise a table's size, or add a table to the layout.
					</p>
				{/if}
			</section>

			{#if overTables.length || noLongerComing.length}
				<section class="section">
					<h2 class="section-heading">Check these</h2>
					<ul class="conflict-list">
						{#each overTables as table (table.id)}
							<li>
								<button type="button" class="link" onclick={() => (selectedTableId = table.id)}>
									{tableTitle(table.id)}
								</button>
								<span>{table.filled} people in {table.capacity} chairs</span>
							</li>
						{/each}
						{#each noLongerComing as guest (guest.id)}
							<li>
								<button type="button" class="link" onclick={() => (selectedTableId = where.get(guest.id) ?? null)}>
									{tableTitle(where.get(guest.id) ?? '')}
								</button>
								<span>{shortName(guest)} {guest.attending === false ? 'is no longer coming' : "hasn't answered"}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section
				class="section guest-list"
				class:drop-hover={listDropHover}
				aria-label="Guests"
				ondragover={(event) => {
					if (!event.dataTransfer?.types.includes(GUEST_DRAG_TYPE)) return;
					event.preventDefault();
					listDropHover = true;
				}}
				ondragleave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) listDropHover = false;
				}}
				ondrop={dropOnList}
			>
				<div class="segmented" role="tablist" aria-label="Which guests to list">
					<button type="button" role="tab" aria-selected={listView === 'unseated'} class:active={listView === 'unseated'} onclick={() => (listView = 'unseated')}>
						Unseated <span class="count">{unseatedCount}</span>
					</button>
					<button type="button" role="tab" aria-selected={listView === 'all'} class:active={listView === 'all'} onclick={() => (listView = 'all')}>
						Everyone <span class="count">{coming.length}</span>
					</button>
				</div>
				<input class="field" type="search" placeholder="Find a guest or party" bind:value={search} />
				{#if listView === 'unseated'}
					<div class="button-row">
						<button class="button" type="button" disabled={!unseatedCount} onclick={runAutoFill}>Auto-seat the rest</button>
					</div>
				{/if}

				{#if pending}
					<p class="placing-note">
						Placing <b>{pending.label}</b> — click a table on the plan.
						<button type="button" class="link" onclick={() => (pending = null)}>Cancel</button>
					</p>
				{/if}

				<div class="party-list">
					{#each parties as party (party.partyId)}
						{@const ids = party.guests.map((guest) => guest.id)}
						{@const need = chairsFilled(ids, noChair)}
						<div
							class="party"
							class:pending={pending?.guestIds.join() === ids.join()}
							style:--hue={partyHue(party.partyId)}
							draggable="true"
							role="group"
							aria-label={party.partyName}
							ondragstart={(event) => startDrag(event, ids)}
							onpointerenter={() => (focusPartyId = party.partyId)}
							onpointerleave={() => (focusPartyId = null)}
						>
							<div
								class="party-head"
								role="button"
								tabindex="0"
								onclick={() => pickParty(party)}
								onkeydown={(event) => activateOnKey(event, () => pickParty(party))}
							>
								<span class="party-name">{party.partyName}</span>
								<span class="party-need">{need}{need !== party.guests.length ? `+${party.guests.length - need}` : ''}</span>
							</div>
							{#if party.guests.length > 1 || listView === 'all'}
								<div class="party-members">
									{#each party.guests as guest (guest.id)}
										<div
											role="button"
											tabindex="0"
											class="member"
											class:pending={pending?.guestIds.length === 1 && pending.guestIds[0] === guest.id}
											class:lap={noChair.has(guest.id)}
											draggable="true"
											ondragstart={(event) => startDrag(event, [guest.id])}
											onclick={() => pickGuest(guest)}
											onkeydown={(event) => activateOnKey(event, () => pickGuest(guest))}
											title={noChair.has(guest.id) ? 'No chair — on a lap' : undefined}
										>
											{shortName(guest)}
											{#if guest.ageGroup !== 'adult'}<span class="age">{guest.ageGroup}</span>{/if}
											{#if listView === 'all' && where.has(guest.id)}
												<span class="at">{numberOf.get(where.get(guest.id)!)}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<p class="empty-note">
							{search ? 'Nobody by that name.' : listView === 'unseated' ? 'Everyone coming has a seat.' : 'Nobody has said yes yet.'}
						</p>
					{/each}
				</div>
			</section>

			{#if splitParties.length}
				<section class="section">
					<h2 class="section-heading">Split across tables</h2>
					<ul class="split-list">
						{#each splitParties as { party, at } (party.partyId)}
							<li style:--hue={partyHue(party.partyId)}>
								<span class="party-swatch"></span>
								<span>{party.partyName}</span>
								<span class="at-list">{at.map((id) => numberOf.get(id)).join(' + ')}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="section">
				<div class="button-row">
					<button class="button" type="button" onclick={exportCsv}>Download CSV</button>
					<button class="button" type="button" disabled={!seatedCount} onclick={clearAll}>Unseat everyone</button>
				</div>
				<p class="hint">
					Drag a party or one person onto a table, or click them and then a table. Drag someone back
					here to unseat them. <kbd>⌘Z</kbd> undoes.
				</p>
			</section>
		{/if}
	</div>
</aside>

<main class="stage">
	<div class="stage-bar">
		<div class="breakdown">
			{#if active}
				<span><b>{numbered.length}</b> tables</span>
				<span><b>{tableStats.filter((t) => t.filled === t.capacity).length}</b> full</span>
				<span><b>{tableStats.filter((t) => t.filled === 0).length}</b> empty</span>
				<span><b>{noChairIds.filter((id) => where.has(id)).length}</b> on laps</span>
			{/if}
		</div>
		<div class="stage-actions">
			<button class="button" type="button" onclick={undo} disabled={!history.length}>Undo</button>
		</div>
	</div>

	<div class="plan-holder" bind:this={holder} onscroll={() => (layoutTick += 1)}>
		{#if active && plan}
			<SeatingCanvas
				{items}
				{numbered}
				{tables}
				{guestsById}
				{noChair}
				{selectedTableId}
				{focusPartyId}
				placing={pending !== null}
				onpick={pickTable}
				onhover={(tableId) => (hoverTableId = tableId)}
				ondropguests={(tableId, ids) => place(ids, tableId)}
			/>
		{:else if active}
			<p class="empty-note stage-note">The layout this chart was drawn on has been deleted.</p>
		{/if}

		{#if drawerItem && drawerSeating && selectedTableId}
			{@const tableId = selectedTableId}
			<div
				class="table-drawer"
				role="dialog"
				aria-label={tableTitle(tableId)}
				bind:offsetHeight={drawerHeight}
				style:left={drawerAt ? `${drawerAt.left}px` : null}
				style:top={drawerAt ? `${drawerAt.top}px` : null}
				style:visibility={drawerAt ? null : 'hidden'}
			>
				<div class="drawer-head">
					<span class="drawer-number">{numberOf.get(tableId)}</span>
					<input
						class="field"
						type="text"
						placeholder="Name this table"
						maxlength="40"
						value={drawerSeating.name}
						onfocus={remember}
						oninput={(event) => patchTable(tableId, { name: event.currentTarget.value }, false)}
					/>
					<button type="button" class="icon-button" aria-label="Close" onclick={() => (selectedTableId = null)}>✕</button>
				</div>

				<div class="drawer-meta">
					<div class="stepper">
						<button type="button" aria-label="One fewer chair" onclick={() => setCapacity(drawerCapacity - 1)}>−</button>
						<span class="readout" class:snug={drawerFilled > drawerCapacity}>
							{drawerFilled}/{drawerCapacity}<small>chairs</small>
						</span>
						<button type="button" aria-label="One more chair" onclick={() => setCapacity(drawerCapacity + 1)}>+</button>
					</div>
					{#if drawerCapacity !== drawerItem.seats}
						<span class="drawer-note">layout has {drawerItem.seats}</span>
					{/if}
				</div>

				{#if drawerGuests.length}
					<ol class="seat-roster">
						{#each drawerGuests as guest, index (guest.id)}
							<li
								style:--hue={partyHue(guest.partyId)}
								class:gone={guest.attending !== true}
								draggable="true"
								ondragstart={(event) => startDrag(event, [guest.id])}
							>
								<span class="party-swatch"></span>
								<span class="roster-name">
									{shortName(guest)}
									{#if rosterDetail(guest)}<small>{rosterDetail(guest)}</small>{/if}
								</span>
								<label class="lap-toggle" title="Sits on a lap and takes no chair">
									<input type="checkbox" checked={noChair.has(guest.id)} onchange={() => toggleNoChair(guest.id)} />
									No chair
								</label>
								<span class="roster-actions">
									<button type="button" class="icon-button" aria-label="Move up" disabled={index === 0} onclick={() => moveInTable(guest.id, -1)}>↑</button>
									<button type="button" class="icon-button" aria-label="Move down" disabled={index === drawerGuests.length - 1} onclick={() => moveInTable(guest.id, 1)}>↓</button>
									<button type="button" class="icon-button danger" aria-label="Unseat {shortName(guest)}" onclick={() => place([guest.id], null)}>✕</button>
								</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="empty-note">Nobody here yet. Drag a party onto this table, or click one in the list.</p>
				{/if}

				<div class="drawer-foot">
					<select class="field" aria-label="Swap everyone with another table" bind:value={swapWith}>
						<option value="">Swap everyone with…</option>
						{#each numbered.filter(({ item }) => item.id !== tableId) as { item } (item.id)}
							<option value={item.id}>{tableTitle(item.id)}</option>
						{/each}
					</select>
					<button class="button" type="button" disabled={!swapWith} onclick={swapSelected}>Swap</button>
				</div>
			</div>
		{/if}

		{#if peekTableId && peekStats}
			<div
				class="table-peek"
				aria-hidden="true"
				bind:offsetHeight={peekHeight}
				style:left={peekAt ? `${peekAt.left}px` : null}
				style:top={peekAt ? `${peekAt.top}px` : null}
				style:visibility={peekAt ? null : 'hidden'}
			>
				<div class="peek-head">
					<span class="peek-title">{tableTitle(peekTableId)}</span>
					<span class="peek-count" class:over={peekStats.filled > peekStats.capacity}>
						{peekStats.filled}/{peekStats.capacity}
					</span>
				</div>
				{#if peekGuests.length}
					<ul class="peek-list">
						{#each peekGuests as guest (guest.id)}
							<li style:--hue={partyHue(guest.partyId)} class:gone={guest.attending !== true}>
								<span class="party-swatch"></span>
								<span class="peek-name">{shortName(guest)}</span>
								{#if noChair.has(guest.id)}<span class="peek-tag">lap</span>
								{:else if guest.ageGroup !== 'adult'}<span class="peek-tag">{guest.ageGroup}</span>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="peek-empty">Nobody seated yet</p>
				{/if}
			</div>
		{/if}

		<div class="toast" class:visible={Boolean(toast)} role="status" aria-live="polite">{toast}</div>
	</div>
</main>
