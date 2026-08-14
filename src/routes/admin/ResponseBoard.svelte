<script lang="ts">
	import type { AdminPartyView } from './party-form';
	import type { Ledger, LedgerView, Pile } from './responses';

	let {
		parties,
		ledger,
		onOpen
	}: {
		parties: AdminPartyView[];
		ledger: Ledger;
		onOpen: (view: LedgerView) => void;
	} = $props();

	const PILES: { id: Pile; label: string }[] = [
		{ id: 'accepting', label: 'accepting' },
		{ id: 'declining', label: 'declining' },
		{ id: 'awaiting', label: 'awaiting' }
	];

	const counts = $derived({
		accepting: ledger.accepting.length,
		declining: ledger.declining.length,
		awaiting: ledger.awaiting.length
	});
	const guests = $derived(counts.accepting + counts.declining + counts.awaiting);
	const answered = $derived(counts.accepting + counts.declining);

	const invited = $derived(parties.filter((p) => p.invited_at).length);
	const responded = $derived(parties.filter((p) => p.responded_at).length);

	// ── the condensed rail ──────────────────────────────────────────────────
	// Landing on a party from the pop-out leaves the board far above you. Once the
	// keys scroll out from under the site nav, the same set of doors reappears as a
	// thin bar; scroll back to the top and it hands off to the board again.
	let navHeight = $state(62);
	let sentinel = $state<HTMLElement | null>(null);
	let condensed = $state(false);

	// The site nav is sticky, not fixed, and its height changes between breakpoints —
	// measure it rather than guessing where the rail should dock.
	$effect(() => {
		const nav = document.querySelector('nav.nav');
		if (!(nav instanceof HTMLElement)) return;
		navHeight = nav.offsetHeight;
		const ro = new ResizeObserver(() => (navHeight = nav.offsetHeight));
		ro.observe(nav);
		return () => ro.disconnect();
	});

	$effect(() => {
		const el = sentinel;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => {
				// Compare against the root's own top edge, not zero: the negative
				// rootMargin means the sentinel stops intersecting while it's still a
				// nav's height *below* the viewport top, and the callback won't fire
				// again on the way past zero.
				const dockLine = entry.rootBounds?.top ?? navHeight;
				condensed = entry.boundingClientRect.top < dockLine;
			},
			{ rootMargin: `-${navHeight}px 0px 0px 0px` }
		);
		io.observe(el);
		return () => io.disconnect();
	});
</script>

{#snippet keys(compact: boolean)}
	{#each PILES as pile (pile.id)}
		<button
			class="key {pile.id}"
			type="button"
			onclick={() => onOpen(pile.id)}
			aria-label={compact ? `${counts[pile.id]} ${pile.label} — open the list` : undefined}
		>
			<span class="dot" aria-hidden="true"></span>
			<b>{counts[pile.id]}</b>
			<span class="key-label">{pile.label}</span>
		</button>
	{/each}
	<span class="rule" aria-hidden="true"></span>
	<button
		class="key wrote"
		type="button"
		onclick={() => onOpen('songs')}
		aria-label={compact ? `${ledger.songs.length} song requests — open the list` : undefined}
	>
		<span class="glyph" aria-hidden="true">♪</span>
		<b>{ledger.songs.length}</b>
		<span class="key-label">song {ledger.songs.length === 1 ? 'request' : 'requests'}</span>
	</button>
	<button
		class="key wrote"
		type="button"
		onclick={() => onOpen('notes')}
		aria-label={compact ? `${ledger.notes.length} notes — open the list` : undefined}
	>
		<!-- A quote mark, not a pencil: ✎ has an emoji presentation on most
		     systems and lands as a coloured blob instead of candlelit type. -->
		<span class="glyph quote" aria-hidden="true">”</span>
		<b>{ledger.notes.length}</b>
		<span class="key-label">{ledger.notes.length === 1 ? 'note' : 'notes'}</span>
	</button>
{/snippet}

{#snippet band(label: string)}
	<div class="band" role="group" aria-label={label}>
		{#each PILES as pile (pile.id)}
			{#if counts[pile.id]}
				<button
					class="stripe {pile.id}"
					type="button"
					style="flex-grow: {counts[pile.id]}"
					onclick={() => onOpen(pile.id)}
					aria-label="{counts[pile.id]} {pile.label} — open the list"
				></button>
			{/if}
		{/each}
	</div>
{/snippet}

<section class="board">
	<div class="board-head">
		<h2>Replies</h2>
		<p class="tally">
			{#if guests}
				<b>{answered}</b> of {guests} {guests === 1 ? 'guest has' : 'guests have'} answered
			{:else}
				No guests on the list yet
			{/if}
		</p>
	</div>

	<!-- The band is the navigation: each stripe is as wide as its pile is big,
	     and pressing one opens that pile. Awaiting is hatched rather than filled —
	     it's the part of the tally not written in yet. -->
	{#if guests}
		{@render band('Replies by answer')}
	{/if}

	<div class="keys">{@render keys(false)}</div>

	<p class="counts">
		{parties.length}
		{parties.length === 1 ? 'party' : 'parties'} · {invited} invited · {responded} responded
	</p>
</section>

<!-- Zero-height marker at the board's lower edge: once it passes under the nav,
     the rail takes over. -->
<div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>

<div
	class="rail"
	class:on={condensed}
	style="top: {navHeight}px"
	inert={!condensed}
	aria-hidden={!condensed}
>
	<div class="rail-inner">
		<div class="keys compact">{@render keys(true)}</div>
	</div>
	{#if guests}
		<div class="rail-band">{@render band('Replies by answer')}</div>
	{/if}
</div>

<style>
	.board {
		border: 1px solid var(--line);
		background: rgba(34, 26, 20, 0.5);
		padding: 1.4rem;
		display: grid;
		gap: 1rem;
	}
	.board-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h2 {
		font-size: 1.3rem;
		color: var(--parchment);
		margin: 0;
	}
	.tally {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-muted);
	}
	.tally b {
		font-family: var(--display);
		font-size: 1.35rem;
		font-weight: 400;
		color: var(--parchment);
		margin-right: 0.15rem;
	}

	/* the band */
	.band {
		display: flex;
		gap: 2px;
		height: 14px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--line);
		padding: 2px;
	}
	.stripe {
		flex-basis: 0;
		min-width: 4px;
		border: 0;
		padding: 0;
		cursor: pointer;
		transition:
			filter 0.2s ease,
			transform 0.2s ease;
		transform-origin: center bottom;
	}
	.stripe:hover,
	.stripe:focus-visible {
		filter: brightness(1.25);
		transform: scaleY(1.35);
	}
	.stripe.accepting {
		background: #9db07f;
	}
	.stripe.declining {
		background: var(--blush);
	}
	.stripe.awaiting {
		background: repeating-linear-gradient(
			-45deg,
			rgba(227, 184, 127, 0.55) 0 2px,
			transparent 2px 5px
		);
	}

	/* legend + pop-out keys — same control, so the whole row reads as one row of doors */
	.keys {
		display: flex;
		align-items: center;
		gap: 0.4rem 0.9rem;
		flex-wrap: wrap;
	}
	.key {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		background: none;
		border: 1px solid transparent;
		border-radius: 0;
		padding: 0.3rem 0.6rem;
		margin: 0 -0.2rem;
		cursor: pointer;
		color: var(--ink-faint);
		font-family: inherit;
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}
	.key:hover,
	.key:focus-visible {
		border-color: var(--line);
		color: var(--ink-muted);
	}
	.key b {
		font-family: var(--display);
		font-size: 1.4rem;
		font-weight: 400;
		line-height: 1;
	}
	.key-label {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dot {
		width: 8px;
		height: 8px;
		align-self: center;
	}
	.accepting .dot {
		background: #9db07f;
	}
	.declining .dot {
		background: var(--blush);
	}
	.awaiting .dot {
		border: 1px solid var(--candle);
	}
	.key.accepting b {
		color: #9db07f;
	}
	.key.declining b {
		color: var(--blush);
	}
	.key.awaiting b,
	.key.wrote b {
		color: var(--parchment);
	}
	.glyph {
		color: var(--candle);
		font-size: 0.95rem;
		align-self: center;
	}
	.glyph.quote {
		font-family: var(--display);
		font-size: 1.3rem;
		line-height: 0;
		align-self: baseline;
	}
	.rule {
		width: 1px;
		align-self: stretch;
		background: var(--line);
		margin: 0 0.2rem;
	}

	/* ── the condensed rail ───────────────────────────────────────────────── */
	.sentinel {
		height: 0;
	}
	/* Fixed, so it never nudges the page when it appears. It docks under the site
	   nav (measured, since the nav is sticky) and sits below it in the stack, so it
	   reads as sliding out from behind. */
	.rail {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 29;
		background: rgba(27, 20, 16, 0.92);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--line);
		transform: translateY(-100%);
		opacity: 0;
		pointer-events: none;
		transition:
			transform 0.24s ease,
			opacity 0.18s ease;
	}
	.rail.on {
		transform: translateY(0);
		opacity: 1;
		pointer-events: auto;
	}
	.rail-inner {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	.keys.compact {
		gap: 0.2rem 0.7rem;
		flex-wrap: nowrap;
		padding: 0.2rem 0;
	}
	.keys.compact .key {
		padding: 0.35rem 0.5rem;
	}
	.keys.compact .key b {
		font-size: 1.1rem;
	}
	.keys.compact .key-label {
		font-size: 0.62rem;
	}
	/* The tally, three pixels tall, along the rail's lower edge — the same object the
	   board shows, condensed rather than replaced. Held to the content width so it
	   reads as belonging to the keys above it, not as a page-wide progress bar. */
	.rail-band {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	.rail-band :global(.band) {
		height: 3px;
		gap: 0;
		padding: 0;
		border: 0;
		background: none;
	}
	.rail-band :global(.stripe:hover),
	.rail-band :global(.stripe:focus-visible) {
		transform: none;
	}

	/* the hard counts, under a rule — context for the tally, not part of it */
	.counts {
		margin: 0;
		border-top: 1px solid var(--line);
		padding-top: 0.9rem;
		font-size: 0.82rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	/* Five labelled keys won't fit a phone in one line. The rail keeps the numbers
	   and their colour, which the board directly above has already taught. */
	@media (max-width: 700px) {
		.keys.compact {
			justify-content: space-between;
			gap: 0;
		}
		.keys.compact .key-label {
			display: none;
		}
	}

	@media (max-width: 560px) {
		/* the keys wrap here, so the divider would land mid-air at the end of a row */
		.rule {
			display: none;
		}
	}
</style>
