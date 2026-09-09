<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { PageData } from './$types';
	import {
		TABLE_CATALOG,
		ZONE_CATALOG,
		catalogEntry,
		isBlockingZone,
		isZone,
		placeItem,
		type CatalogEntry
	} from '$lib/pavilion/catalog';
	import { PRESETS } from '$lib/pavilion/presets';
	import {
		DEFAULT_SPACING,
		LANE_PRESETS,
		boundsOf,
		centresForRule,
		countSeats,
		findConflicts,
		gapBetween,
		gapToBounds,
		laneForCentres,
		laneShare,
		seatWidthInches,
		seatedGuestReach
	} from '$lib/pavilion/spacing';
	import { surfaceAt } from '$lib/pavilion/venue';
	import type { PlanItem, SavedPlan, SpacingRule } from '$lib/pavilion/types';
	import PlanCanvas from './PlanCanvas.svelte';
	import '@fontsource/archivo/400.css';
	import '@fontsource/archivo/500.css';
	import '@fontsource/archivo/600.css';
	import '@fontsource/spline-sans-mono/400.css';
	import '@fontsource/spline-sans-mono/500.css';
	import './seating.css';

	let { data }: { data: PageData } = $props();

	const WORKING_KEY = 'aldridge.pavilion.working.v3';
	const NUDGE_FEET = 0.5;
	const FINE_NUDGE_FEET = 0.25;

	let items = $state<PlanItem[]>(PRESETS[0].build());
	let spacing = $state<SpacingRule>({ ...DEFAULT_SPACING });
	let selectedId = $state<string | null>(null);
	let history = $state<PlanItem[][]>([]);
	// Seeded once from the loader, then owned locally so a save or delete shows up
	// without a round trip.
	let savedPlans = $state<SavedPlan[]>(untrack(() => data.plans));
	let planName = $state('');
	let saving = $state(false);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	let display = $state({
		guestZone: true,
		lane: true,
		chairs: true,
		bays: true,
		dimensions: true
	});

	const conflicts = $derived(findConflicts(items, spacing));
	const selected = $derived(items.find((item) => item.id === selectedId) ?? null);
	const guestTables = $derived(
		items.filter((item) => item.category === 'guestTable' && item.seats > 0)
	);
	const totalSeats = $derived(countSeats(items));
	const serviceTableCount = $derived(
		items.filter((item) => item.category === 'serviceTable').length
	);
	const centres = $derived(centresForRule(spacing));

	const bySurface = $derived.by(() => {
		const tally = {
			pavilion: { tables: 0, seats: 0 },
			patio: { tables: 0, seats: 0 },
			grounds: { tables: 0, seats: 0 }
		};
		for (const table of guestTables) {
			const bucket = tally[surfaceAt(table.x, table.y)];
			bucket.tables += 1;
			bucket.seats += table.seats;
		}
		return tally;
	});

	/* ---- persistence of the in-progress layout (per browser) ------------- */

	onMount(() => {
		try {
			const raw = localStorage.getItem(WORKING_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed?.items) && parsed.items.length) items = parsed.items;
			if (parsed?.spacing) spacing = { ...DEFAULT_SPACING, ...parsed.spacing };
		} catch {
			// A private window or blocked storage just starts from the first preset.
		}
	});

	$effect(() => {
		const snapshot = JSON.stringify({ items, spacing });
		try {
			localStorage.setItem(WORKING_KEY, snapshot);
		} catch {
			// Nothing to do — the plan still works, it just will not survive a reload.
		}
	});

	/* ---- editing --------------------------------------------------------- */

	function remember() {
		history = [...history.slice(-59), items.map((item) => ({ ...item }))];
	}

	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		history = history.slice(0, -1);
		items = previous;
		selectedId = null;
	}

	function patchSelected(patch: Partial<PlanItem>) {
		if (!selected) return;
		remember();
		items = items.map((item) => (item.id === selected.id ? { ...item, ...patch } : item));
	}

	function duplicateSelected() {
		if (!selected) return;
		remember();
		const copy = { ...selected, id: placeItem(selected.key, 0, 0).id, x: selected.x + 3, y: selected.y + 3 };
		items = [...items, copy];
		selectedId = copy.id;
	}

	function removeSelected() {
		if (!selected) return;
		remember();
		items = items.filter((item) => item.id !== selected.id);
		selectedId = null;
	}

	/** Walk the floor for somewhere a new piece will not immediately crowd anything. */
	function openSpot(entry: CatalogEntry): { x: number; y: number } {
		const probe: PlanItem = placeItem(entry.key, 0, 0);
		for (let y = 5; y <= 35; y += 1.5) {
			for (let x = 5; x <= 73; x += 1.5) {
				probe.x = x;
				probe.y = y;
				const clear = items.every((other) => {
					if (isZone(other)) {
						return (
							!isBlockingZone(other) ||
							gapToBounds(probe, boundsOf(other)) >= seatedGuestReach(probe, spacing)
						);
					}
					if (!probe.seats && !other.seats) return true;
					return (
						gapBetween(probe, other) >=
						seatedGuestReach(probe, spacing) +
							seatedGuestReach(other, spacing) +
							spacing.walkingLaneFeet
					);
				});
				if (clear) return { x, y };
			}
		}
		return { x: 30, y: 20 };
	}

	function addFromCatalog(entry: CatalogEntry) {
		remember();
		const spot = openSpot(entry);
		const item = placeItem(entry.key, spot.x, spot.y);
		items = [...items, item];
		selectedId = item.id;
		showToast(`${entry.label} added — drag it into place`);
	}

	function loadPreset(preset: (typeof PRESETS)[number]) {
		remember();
		items = preset.build();
		selectedId = null;
		showToast(`${preset.name} — ${countSeats(items)} seats`);
	}

	function clearTables() {
		remember();
		items = items.filter(isZone);
		selectedId = null;
		showToast('Tables cleared — zones kept');
	}

	function applyLanePreset(centresFeet: number) {
		spacing = {
			...spacing,
			walkingLaneFeet: laneForCentres(centresFeet, spacing.seatedGuestFeet)
		};
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.matches('input, textarea, select')) return;
		const meta = event.metaKey || event.ctrlKey;

		if (meta && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			undo();
			return;
		}
		if (!selected) return;
		if (meta && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			duplicateSelected();
			return;
		}
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			removeSelected();
			return;
		}
		if (event.key === 'Escape') {
			selectedId = null;
			return;
		}

		const nudges: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		const nudge = nudges[event.key];
		if (!nudge) return;
		event.preventDefault();
		const stride = event.shiftKey ? FINE_NUDGE_FEET : NUDGE_FEET;
		patchSelected({
			x: Math.round((selected.x + nudge[0] * stride) * 100) / 100,
			y: Math.round((selected.y + nudge[1] * stride) * 100) / 100
		});
	}

	/* ---- saved plans, shared by everyone with the link ------------------- */

	function showToast(message: string) {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2600);
	}

	async function savePlan() {
		const name = planName.trim() || `Plan ${savedPlans.length + 1}`;
		saving = true;
		try {
			const response = await fetch('/api/seating', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, items, spacing })
			});
			const body = await response.json();
			if (!response.ok) {
				showToast(body?.error ?? 'Could not save the plan.');
				return;
			}
			savedPlans = [body.plan, ...savedPlans];
			planName = '';
			showToast(`Saved “${name}” — everyone with the link sees it`);
		} catch {
			showToast('Could not reach the server.');
		} finally {
			saving = false;
		}
	}

	function openPlan(plan: SavedPlan) {
		remember();
		items = plan.items.map((item) => ({ ...item }));
		spacing = { ...DEFAULT_SPACING, ...plan.spacing };
		selectedId = null;
		showToast(`Opened “${plan.name}”`);
	}

	async function deletePlan(plan: SavedPlan) {
		const response = await fetch(`/api/seating?id=${encodeURIComponent(plan.id)}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			showToast(body?.error ?? 'Could not delete that plan.');
			return;
		}
		savedPlans = savedPlans.filter((other) => other.id !== plan.id);
		showToast(`Deleted “${plan.name}”`);
	}

	const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
	const savedOn = (plan: SavedPlan) => dateFormat.format(new Date(plan.createdAt));

	const swatchToken = (entry: CatalogEntry) =>
		entry.category === 'guestTable'
			? 'accent'
			: entry.category === 'serviceTable'
				? 'clay'
				: entry.category === 'danceFloor'
					? 'brass'
					: entry.category === 'discJockey'
						? 'plum'
						: 'rule-strong';
</script>

<svelte:head>
	<title>Pavilion Seating — Aldridge Gardens</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="seating-workspace">
	<aside class="rail">
		<div class="masthead">
			<h1>Aldridge Pavilion Seating</h1>
			<p class="occasion">Osborne · Connally — 6 Nov 2026</p>
		</div>

		<div class="rail-scroll">
			<section class="section">
				<dl class="tally">
					<div><dt>Tables</dt><dd>{guestTables.length}</dd></div>
					<div><dt>Seats</dt><dd>{totalSeats}</dd></div>
					<div class:flagged={conflicts.notices.length > 0}>
						<dt>Pinched</dt>
						<dd>{conflicts.notices.length}</dd>
					</div>
				</dl>
			</section>

			<section class="section">
				<h2 class="section-heading">Room to sit and walk</h2>

				<div class="rule-row">
					<span class="rule-name">Seated guest</span>
					<span class="rule-value">{Math.round(spacing.seatedGuestFeet * 12)}″</span>
					<input
						type="range"
						min="18"
						max="36"
						step="1"
						value={Math.round(spacing.seatedGuestFeet * 12)}
						oninput={(event) =>
							(spacing = {
								...spacing,
								seatedGuestFeet: Number(event.currentTarget.value) / 12
							})}
					/>
					<span class="rule-note">
						From the table edge to the back of a chair with someone in it. Banquets plan on 24″.
					</span>
				</div>

				<div class="rule-row">
					<span class="rule-name">Walking lane</span>
					<span class="rule-value">{Math.round(spacing.walkingLaneFeet * 12)}″</span>
					<input
						type="range"
						min="12"
						max="60"
						step="1"
						value={Math.round(spacing.walkingLaneFeet * 12)}
						oninput={(event) =>
							(spacing = {
								...spacing,
								walkingLaneFeet: Number(event.currentTarget.value) / 12
							})}
					/>
					<span class="rule-note">
						Clear floor between the backs of two seated guests. 12″ is the squeeze most venues
						actually set; 36″ walks comfortably; 48–60″ where servers work.
					</span>
				</div>

				<div class="lane-presets">
					{#each LANE_PRESETS as preset (preset.label)}
						<button
							type="button"
							class:active={Math.abs(preset.centresFeet - centres) < 0.05}
							onclick={() => applyLanePreset(preset.centresFeet)}
						>
							<b>{preset.label}</b>
							<small>{preset.centresFeet} ft</small>
						</button>
					{/each}
				</div>

				<p class="derived">
					At this setting a 60″ round needs <b>{Math.round(centres * 10) / 10} ft</b> from centre to
					centre, and fills a
					<b>{Math.round((5 + 2 * spacing.seatedGuestFeet) * 10) / 10} ft</b> circle once everyone is
					seated. Each table's dashed ring carries half the lane, so rings that touch sit exactly on
					the rule — only overlapping rings are too tight.
				</p>
			</section>

			<section class="section">
				<h2 class="section-heading">Starting layouts</h2>
				<div class="preset-list">
					{#each PRESETS as preset (preset.key)}
						<button class="preset" type="button" onclick={() => loadPreset(preset)}>
							<strong>{preset.name}</strong>
							<span class="capacity">{countSeats(preset.build())} seats</span>
							<em>{preset.blurb}</em>
						</button>
					{/each}
				</div>
			</section>

			<section class="section">
				<h2 class="section-heading">Add a table</h2>
				<div class="chip-grid">
					{#each TABLE_CATALOG as entry (entry.key)}
						<button class="chip" type="button" onclick={() => addFromCatalog(entry)}>
							<span
								class="swatch"
								class:square={entry.shape === 'rect'}
								style="color: var(--{swatchToken(entry)})"
							></span>
							<span>{entry.label}</span>
							{#if entry.seats}<span class="seat-note">{entry.seats}</span>{/if}
						</button>
					{/each}
				</div>
			</section>

			<section class="section">
				<h2 class="section-heading">Add a zone</h2>
				<div class="chip-grid">
					{#each ZONE_CATALOG as entry (entry.key)}
						<button class="chip" type="button" onclick={() => addFromCatalog(entry)}>
							<span
								class="swatch square"
								style="color: var(--{swatchToken(entry)})"
							></span>
							<span>{entry.label}</span>
						</button>
					{/each}
				</div>
			</section>

			{#if conflicts.notices.length}
				<section class="section">
					<h2 class="section-heading">Pinched spots</h2>
					<ul class="conflict-list">
						{#each conflicts.notices.slice(0, 10) as notice, index (index)}
							<li>
								<span class="locator">{notice.locator}</span>
								<span>{notice.message}</span>
							</li>
						{/each}
						{#if conflicts.notices.length > 10}
							<li>and {conflicts.notices.length - 10} more.</li>
						{/if}
					</ul>
				</section>
			{/if}

			<section class="section">
				<h2 class="section-heading">Saved plans</h2>
				<input
					class="field"
					type="text"
					placeholder="Name this plan"
					maxlength="60"
					bind:value={planName}
				/>
				<div class="button-row">
					<button class="button primary" type="button" onclick={savePlan} disabled={saving}>
						{saving ? 'Saving…' : 'Save plan'}
					</button>
				</div>
				<div class="saved-list">
					{#if data.plansUnavailable}
						<p class="empty-note">
							Saved plans are unavailable right now — the plan you are drawing is still safe in
							this browser.
						</p>
					{:else if !savedPlans.length}
						<p class="empty-note">
							Nothing saved yet. Anything you save here is shared with everyone who has this link.
						</p>
					{/if}
					{#each savedPlans as plan (plan.id)}
						<div class="saved">
							<div class="saved-name">
								<b>{plan.name}</b>
								<small>{plan.seats} seats · {savedOn(plan)}</small>
							</div>
							<button class="icon-button" type="button" onclick={() => openPlan(plan)}>Open</button>
							{#if data.canDelete}
								<button class="icon-button danger" type="button" onclick={() => deletePlan(plan)}>
									Delete
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</section>

			<section class="section">
				<h2 class="section-heading">Drawing</h2>
				<div class="toggle-list">
					<label class="toggle">
						<input type="checkbox" bind:checked={display.guestZone} /> Seated-guest footprint
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={display.lane} /> Walking-lane boundary
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={display.chairs} /> Individual chairs
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={display.bays} /> Column bay grid
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={display.dimensions} /> Dimensions &amp; outlets
					</label>
				</div>
				<p class="hint">
					Drag anything. <kbd>←→↑↓</kbd> nudges 6″, <kbd>Alt</kbd> drags off-grid,
					<kbd>⌘D</kbd> duplicates, <kbd>⌘Z</kbd> undoes, <kbd>Del</kbd> removes.
				</p>
			</section>
		</div>
	</aside>

	<main class="stage">
		<div class="stage-bar">
			<div class="breakdown">
				<span>Pavilion <b>{bySurface.pavilion.tables}</b> tables / <b>{bySurface.pavilion.seats}</b> seats</span>
				<span>Patio <b>{bySurface.patio.tables}</b> / <b>{bySurface.patio.seats}</b></span>
				<span>Grounds <b>{bySurface.grounds.tables}</b> / <b>{bySurface.grounds.seats}</b></span>
				<span>Service tables <b>{serviceTableCount}</b></span>
			</div>
			<div class="stage-actions">
				<button class="button" type="button" onclick={undo} disabled={!history.length}>Undo</button>
				<button class="button" type="button" onclick={clearTables}>Clear tables</button>
			</div>
		</div>

		<div class="plan-holder">
			<PlanCanvas
				{items}
				{spacing}
				{conflicts}
				{selectedId}
				{display}
				onselect={(id) => (selectedId = id)}
				onchange={(next) => (items = next)}
				oncommit={() => {}}
			/>

			{#if selected}
				{@const perGuest = seatWidthInches(selected)}
				<div class="inspector">
					<span class="name">{selected.label}</span>
					<span class="divider"></span>

					{#if !isZone(selected)}
						<div class="stepper">
							<button
								type="button"
								aria-label="One fewer seat"
								onclick={() => patchSelected({ seats: Math.max(0, selected.seats - 1) })}>−</button
							>
							<span class="readout" class:snug={perGuest > 0 && perGuest < 20}>
								{selected.seats}
								<small>seats{perGuest ? ` · ${perGuest}″ each` : ''}</small>
							</span>
							<button
								type="button"
								aria-label="One more seat"
								onclick={() => patchSelected({ seats: Math.min(14, selected.seats + 1) })}>+</button
							>
						</div>
					{/if}

					{#if !isZone(selected) && selected.shape === 'rect'}
						<div class="stepper">
							<button
								type="button"
								aria-label="Rotate counter-clockwise"
								onclick={() =>
									patchSelected({ rotationDegrees: (selected.rotationDegrees + 345) % 360 })}>↺</button
							>
							<span class="readout">{selected.rotationDegrees}°</span>
							<button
								type="button"
								aria-label="Rotate clockwise"
								onclick={() =>
									patchSelected({ rotationDegrees: (selected.rotationDegrees + 15) % 360 })}>↻</button
							>
						</div>
					{/if}

					{#if isZone(selected)}
						<div class="stepper">
							<span class="readout">
								{Math.round(selected.widthFeet * 10) / 10} × {Math.round(selected.depthFeet * 10) / 10}
								<small>ft</small>
							</span>
						</div>
					{/if}

					<span class="divider"></span>
					<button class="icon-button" type="button" onclick={duplicateSelected}>Duplicate</button>
					<button class="icon-button danger" type="button" onclick={removeSelected}>Remove</button>
				</div>
			{/if}

			<div class="toast" class:visible={Boolean(toast)} role="status" aria-live="polite">
				{toast}
			</div>
		</div>
	</main>
</div>
