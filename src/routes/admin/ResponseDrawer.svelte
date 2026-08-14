<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		VIEWS,
		guestHay,
		noteHay,
		songHay,
		songsAsText,
		type Ledger,
		type LedgerView
	} from './responses';

	let {
		open = $bindable(false),
		view = $bindable<LedgerView>('accepting'),
		ledger,
		notify,
		onJump
	}: {
		open?: boolean;
		view?: LedgerView;
		ledger: Ledger;
		notify: (text: string, kind?: 'ok' | 'err') => void;
		/** Close the pop-out, reveal that party in the list below, and expand it. */
		onJump: (partyId: string) => void;
	} = $props();

	let query = $state('');
	let searchEl = $state<HTMLInputElement | null>(null);
	let panelEl = $state<HTMLElement | null>(null);

	/** Which rows have their household's note open. Several can be open at once — reading
	    two declines side by side is the point. */
	const openNotes = new SvelteSet<string>();
	const toggleNote = (key: string) =>
		openNotes.has(key) ? openNotes.delete(key) : openNotes.add(key);

	// Svelte's transitions are JS-driven, so the global reduced-motion rule in
	// layout.css can't reach them — check the preference here instead.
	const glide = (node: Element, args: { x?: number; duration: number }) =>
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
			? fade(node, { duration: 0 })
			: fly(node, args);

	// Freeze the page behind the pop-out the same way the nav drawer does: the
	// document root never scrolls here, .scroll-root does.
	$effect(() => {
		if (!open) return;
		document.documentElement.classList.add('drawer-open');
		return () => document.documentElement.classList.remove('drawer-open');
	});

	$effect(() => {
		if (open) searchEl?.focus();
	});

	function close() {
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
			return;
		}
		// Keep Tab inside the panel — the party list behind it is a long trap otherwise.
		if (e.key !== 'Tab' || !panelEl) return;
		const focusable = [
			...panelEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		].filter((el) => el.offsetParent !== null);
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || !panelEl.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	const q = $derived(query.trim().toLowerCase());
	const guestRows = $derived(
		view === 'accepting' || view === 'declining' || view === 'awaiting'
			? ledger[view].filter((r) => !q || guestHay(r).includes(q))
			: []
	);
	const songRows = $derived(
		view === 'songs' ? ledger.songs.filter((r) => !q || songHay(r).includes(q)) : []
	);
	const noteRows = $derived(
		view === 'notes' ? ledger.notes.filter((r) => !q || noteHay(r).includes(q)) : []
	);
	const shown = $derived(
		view === 'songs' ? songRows.length : view === 'notes' ? noteRows.length : guestRows.length
	);
	const total = $derived(ledger[view].length);

	// A decline usually explains itself in the household's note, so the pile offers
	// to open every one at once rather than making you press them one by one.
	const withNotes = $derived(guestRows.filter((r) => r.party.message.trim()));
	const allNotesShown = $derived(
		withNotes.length > 0 && withNotes.every((r) => openNotes.has(r.key))
	);
	function toggleAllNotes() {
		if (allNotesShown) for (const r of withNotes) openNotes.delete(r.key);
		else for (const r of withNotes) openNotes.add(r.key);
	}

	const SUBTITLES: Record<LedgerView, string> = {
		accepting: 'Everyone who said yes.',
		declining: 'Everyone who sent regrets.',
		awaiting: 'Guests with no answer on the card yet.',
		songs: 'What each household wants to hear.',
		notes: 'Messages left with an RSVP, and your own notes on a party.'
	};
	const PLACEHOLDERS: Record<LedgerView, string> = {
		accepting: 'Search guests, parties, allergies…',
		declining: 'Search guests and parties…',
		awaiting: 'Search guests and parties…',
		songs: 'Search songs and parties…',
		notes: 'Search notes and parties…'
	};
	const EMPTY: Record<LedgerView, string> = {
		accepting: 'No one has accepted yet. Send the invitations and the replies will land here.',
		declining: 'No regrets yet.',
		awaiting: 'Everyone has answered. Nothing left to chase.',
		songs: 'No song requests yet — they come in with the RSVPs.',
		notes: 'No notes yet. Anything a household writes on their RSVP shows up here.'
	};

	async function copySongs() {
		try {
			await navigator.clipboard.writeText(songsAsText(songRows));
			notify(`Copied ${songRows.length} song ${songRows.length === 1 ? 'request' : 'requests'}.`);
		} catch {
			notify('Couldn’t reach the clipboard — select the list and copy it by hand.', 'err');
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="scrim" onclick={close} transition:fade={{ duration: 150 }}></div>
	<aside
		class="drawer"
		bind:this={panelEl}
		transition:glide={{ x: 460, duration: 220 }}
		aria-label="Replies"
	>
		<header class="head">
			<div class="titles">
				<h2>{VIEWS.find((v) => v.id === view)?.label}</h2>
				<p>{SUBTITLES[view]}</p>
			</div>
			<button class="close" type="button" onclick={close} aria-label="Close">✕</button>
		</header>

		<nav class="tabs" aria-label="Which replies to show">
			{#each VIEWS as v (v.id)}
				<button
					class="tab"
					class:on={view === v.id}
					type="button"
					aria-current={view === v.id ? 'true' : undefined}
					onclick={() => (view = v.id)}
				>
					{v.label}
					<span class="n">{ledger[v.id].length}</span>
				</button>
			{/each}
		</nav>

		<div class="tools">
			<input
				bind:this={searchEl}
				bind:value={query}
				class="search"
				type="search"
				placeholder={PLACEHOLDERS[view]}
			/>
			{#if view === 'songs' && songRows.length}
				<button class="mini" type="button" onclick={copySongs}>Copy list</button>
			{:else if withNotes.length}
				<button class="mini" type="button" onclick={toggleAllNotes}>
					{allNotesShown ? 'Hide' : 'Show'}
					{withNotes.length}
					{withNotes.length === 1 ? 'note' : 'notes'}
				</button>
			{/if}
		</div>
		{#if q}
			<p class="showing">{shown} of {total} {shown === 1 ? 'match' : 'matches'}</p>
		{/if}

		<div class="list">
			{#if view === 'songs'}
				{#each songRows as row (row.key)}
					<button class="card song" type="button" onclick={() => onJump(row.party.id)}>
						<span class="note-glyph" aria-hidden="true">♪</span>
						<span class="body">
							<span class="text">{row.text}</span>
							<span class="from">{row.party.display_name}</span>
						</span>
					</button>
				{/each}
			{:else if view === 'notes'}
				{#each noteRows as row (row.key)}
					<button class="card note" class:private={row.kind === 'private'} type="button" onclick={() => onJump(row.party.id)}>
						<span class="body">
							<span class="text">{row.text}</span>
						<span class="from">
								{row.party.display_name}
								<!-- Most notes here are RSVP notes, so only the odd one out is labelled. -->
								{#if row.kind === 'private'}<span class="tag">your note</span>{/if}
							</span>
						</span>
					</button>
				{/each}
			{:else}
				{#each guestRows as row (row.key)}
					<!-- A one-person party is usually named after that person — repeating the
					     name back adds nothing, so the party line only shows when it differs. -->
					{@const from = row.party.display_name === row.guest.name ? '' : row.party.display_name}
					{@const diet = row.guest.dietary?.trim() ?? ''}
					{@const chase = view === 'awaiting' && !row.party.invited_at}
					{@const note = row.party.message.trim()}
					{@const showing = openNotes.has(row.key)}
					<div class="entry {view}">
						<div class="row">
							<button class="card person" type="button" onclick={() => onJump(row.party.id)}>
								<span class="body">
									<span class="who">{row.guest.name || 'Plus-one (unnamed)'}</span>
									{#if from || diet || chase}
										<span class="from">
											{from}
											{#if diet}<span class="tag diet">{diet}</span>{/if}
											{#if chase}<span class="tag">not invited</span>{/if}
										</span>
									{/if}
								</span>
							</button>
							{#if note}
								<!-- The reason someone declined is usually in their note. Reading it
								     here beats losing your place in the pile to go find it. -->
								<button
									class="peek"
									class:on={showing}
									type="button"
									aria-expanded={showing}
									aria-controls="note-{row.key}"
									title={showing ? 'Hide their note' : 'Read their note'}
									onclick={() => toggleNote(row.key)}
								>
									<span aria-hidden="true">”</span>
									<span class="sr">{showing ? 'Hide' : 'Read'} the note from {row.party.display_name}</span>
								</button>
							{/if}
						</div>
						{#if note && showing}
							<p class="peeked" id="note-{row.key}">{note}</p>
						{/if}
					</div>
				{/each}
			{/if}

			{#if !shown}
				<p class="empty">{q ? `Nothing matches “${query.trim()}”.` : EMPTY[view]}</p>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(12, 8, 6, 0.62);
		z-index: 70;
	}
	.drawer {
		--body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(500px, 100vw);
		z-index: 71;
		background: var(--espresso);
		border-left: 1px solid var(--line);
		box-shadow: -24px 0 60px rgba(0, 0, 0, 0.55);
		font-family: var(--body);
		/* Column flex, not a row template — the match count comes and goes, and a
		   grid track list would hand the wrong row the remaining height. */
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.3rem 1.3rem 0.9rem;
		flex: none;
	}
	.titles h2 {
		font-family: var(--display);
		font-size: 1.35rem;
		font-weight: 400;
		color: var(--parchment);
		margin: 0;
	}
	.titles p {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--ink-faint);
	}
	.close {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-size: 0.85rem;
		line-height: 1;
		padding: 0.45rem 0.6rem;
		cursor: pointer;
		flex: none;
		transition: border-color 0.2s ease;
	}
	.close:hover {
		border-color: var(--candle);
		color: var(--parchment);
	}

	/* Wraps rather than scrolls — a hidden fifth tab is a hidden fifth pile. */
	.tabs {
		display: flex;
		flex-wrap: wrap;
		column-gap: 0.15rem;
		border-bottom: 1px solid var(--line);
		padding: 0 1.3rem;
		flex: none;
	}
	.tab {
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		color: var(--ink-faint);
		font-family: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.7rem 0.45rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		transition: color 0.2s ease;
	}
	.tab:first-child {
		padding-left: 0;
	}
	.tab:hover {
		color: var(--ink-muted);
	}
	.tab.on {
		color: var(--parchment);
		border-bottom-color: var(--candle);
	}
	.tab .n {
		font-family: var(--display);
		font-size: 0.9rem;
		letter-spacing: 0;
		text-transform: none;
		color: var(--candle);
	}

	.tools {
		display: flex;
		gap: 0.6rem;
		padding: 0.9rem 1.3rem 0;
		flex: none;
	}
	.search {
		flex: 1;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		font-family: inherit;
		font-size: 0.95rem;
		padding: 0.45rem 0.7rem;
		min-width: 0;
	}
	.search:focus {
		outline: none;
		border-color: var(--candle);
	}
	.mini {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		padding: 0 0.8rem;
		cursor: pointer;
		white-space: nowrap;
		transition: border-color 0.2s ease;
	}
	.mini:hover {
		border-color: var(--candle);
		color: var(--parchment);
	}
	.showing {
		margin: 0.5rem 0 0;
		padding: 0 1.3rem;
		font-size: 0.78rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-faint);
		flex: none;
	}

	.list {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.9rem 1.3rem 2rem;
		display: grid;
		align-content: start;
		min-height: 0;
	}

	/* Ruled rows, not floating cards — press one to land on that party below. */
	.card {
		display: flex;
		gap: 0.7rem;
		width: 100%;
		text-align: left;
		background: rgba(0, 0, 0, 0.14);
		border: 0;
		border-bottom: 1px solid rgba(230, 217, 198, 0.09);
		border-left: 2px solid var(--line);
		color: var(--ink-on-dark);
		font-family: inherit;
		padding: 0.65rem 0.8rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.card:last-child {
		border-bottom-color: transparent;
	}
	.card:hover,
	.card:focus-visible {
		background: rgba(227, 184, 127, 0.08);
	}

	/* A person's row carries the state rule and, when their household wrote
	   something, a mark that opens the note underneath without leaving the pile. */
	.entry {
		background: rgba(0, 0, 0, 0.14);
		border-left: 2px solid var(--line);
		border-bottom: 1px solid rgba(230, 217, 198, 0.09);
	}
	.entry:last-child {
		border-bottom-color: transparent;
	}
	.entry.accepting {
		border-left-color: #9db07f;
	}
	.entry.declining {
		border-left-color: var(--blush);
	}
	.entry.awaiting {
		border-left-color: rgba(227, 184, 127, 0.5);
	}
	.row {
		display: flex;
		align-items: stretch;
	}
	.entry .card {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
	}
	/* same specificity as the base hover, and later in the file — so it wins */
	.entry .card:hover,
	.entry .card:focus-visible {
		background: rgba(227, 184, 127, 0.08);
	}
	.peek {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 0;
		border-left: 1px solid rgba(230, 217, 198, 0.08);
		color: var(--candle);
		font-family: var(--display);
		font-size: 1.5rem;
		line-height: 1;
		padding: 0 0.85rem;
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity 0.2s ease,
			background 0.15s ease;
	}
	/* A closing quote hangs from the cap line — nudge it back to the optical middle. */
	.peek span[aria-hidden] {
		display: block;
		transform: translateY(0.28em);
	}
	.peek:hover,
	.peek:focus-visible,
	.peek.on {
		opacity: 1;
		background: rgba(227, 184, 127, 0.08);
	}
	.peeked {
		margin: 0;
		padding: 0 0.9rem 0.75rem;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--ink-muted);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.card .body {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		flex: 1;
	}
	.who,
	.text {
		font-size: 0.95rem;
		color: var(--ink-on-dark);
		overflow-wrap: anywhere;
	}
	.text {
		white-space: pre-line;
	}
	.from {
		font-size: 0.78rem;
		color: var(--ink-faint);
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.62rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		border: 1px solid var(--line);
		padding: 0.05rem 0.4rem;
		color: var(--ink-faint);
	}
	.tag.diet {
		border-color: rgba(227, 184, 127, 0.4);
		color: var(--candle);
		text-transform: none;
		letter-spacing: 0.02em;
		font-size: 0.7rem;
	}
	.meal {
		font-size: 0.72rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--candle);
		white-space: nowrap;
		flex: none;
	}
	.meal.missing {
		letter-spacing: 0.02em;
		text-transform: none;
		font-size: 0.75rem;
		color: var(--ink-faint);
		opacity: 0.7;
	}

	.song,
	.note {
		border-left-color: var(--candle);
	}
	.note.private {
		border-left-color: var(--line);
		background: rgba(0, 0, 0, 0.26);
	}
	.note-glyph {
		color: var(--candle);
		font-size: 1rem;
		line-height: 1.4;
	}

	.empty {
		margin: 0.6rem 0 0;
		font-size: 0.9rem;
		color: var(--ink-faint);
	}
</style>
