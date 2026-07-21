<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmButton from './ConfirmButton.svelte';
	import {
		blankGuest,
		emailError,
		isBlankRow,
		parsePastedGuests,
		phoneError,
		phoneWarning,
		type AdminPartyView,
		type GuestDraft,
		type PartyDraft
	} from './party-form';

	let {
		party = null,
		draft = null,
		notify = () => {},
		onSaved,
		onDiscard,
		onDirty
	}: {
		/** Edit mode: the stored party this editor works on a local copy of. */
		party?: AdminPartyView | null;
		/** Draft mode: a page-owned draft object, mutated in place so the page can persist it. */
		draft?: PartyDraft | null;
		notify?: (text: string, kind?: 'ok' | 'err') => void;
		onSaved?: (name: string) => void;
		onDiscard?: () => void;
		onDirty?: (dirty: boolean) => void;
	} = $props();

	const fromParty = (p: AdminPartyView): PartyDraft => ({
		key: p.id,
		display_name: p.display_name,
		contact_email: p.contact_email,
		contact_phone: p.contact_phone,
		notes: p.notes,
		guests: p.guests.map((g) => ({
			id: g.id,
			name: g.name,
			email: g.email ?? '',
			phone: g.phone ?? '',
			is_plus_one: g.is_plus_one,
			attending: g.attending,
			meal: g.meal,
			dietary: g.dietary
		}))
	});

	// Seeded once from the initial prop — edit mode re-seeds explicitly after each save.
	// svelte-ignore state_referenced_locally
	const initial = party ? fromParty(party) : draft!;
	if (!initial.guests.length) initial.guests.push(blankGuest());
	let model = $state<PartyDraft>(initial);

	/** What actually gets saved — trimmed, blank rows dropped, RSVP fields stripped. */
	const snapGuests = (m: PartyDraft) =>
		m.guests
			.filter((g) => !isBlankRow(g))
			.map((g) => ({
				id: g.id,
				name: g.name.trim(),
				email: g.email.trim(),
				phone: g.phone.trim(),
				is_plus_one: g.is_plus_one
			}));
	const snap = (m: PartyDraft) =>
		JSON.stringify({
			display_name: m.display_name.trim(),
			contact_email: m.contact_email.trim(),
			contact_phone: m.contact_phone.trim(),
			notes: m.notes.trim(),
			guests: snapGuests(m)
		});

	// svelte-ignore state_referenced_locally
	let baseline = $state(party ? snap(initial) : '');
	const dirty = $derived(party ? snap(model) !== baseline : false);
	$effect(() => {
		onDirty?.(dirty);
		return () => onDirty?.(false);
	});

	const guestsJson = $derived(JSON.stringify(snapGuests(model)));
	const guestCount = $derived(model.guests.filter((g) => !isBlankRow(g)).length);

	// ── validation ──────────────────────────────────────────────────────────
	// Errors show per field once it's been left (or after a save attempt) —
	// never while someone is still typing their first character.
	let attempted = $state(false);
	let touchedTop = $state<Record<string, boolean>>({});
	const rowTouched = new SvelteMap<GuestDraft, Record<string, boolean>>();
	const touchTop = (f: string) => (touchedTop[f] = true);
	const touchRow = (g: GuestDraft, f: string) =>
		rowTouched.set(g, { ...(rowTouched.get(g) ?? {}), [f]: true });
	const showTop = (f: string) => attempted || !!touchedTop[f];
	const showRow = (g: GuestDraft, f: string) => attempted || !!rowTouched.get(g)?.[f];

	const rowError = (g: GuestDraft) =>
		isBlankRow(g)
			? { name: '', email: '', phone: '', warn: '' }
			: {
					name:
						!g.is_plus_one && !g.name.trim()
							? 'Give this guest a name, or mark the row as a plus-one.'
							: '',
					email: emailError(g.email),
					phone: phoneError(g.phone),
					warn: phoneWarning(g.phone)
				};

	const topErrors = $derived({
		display_name: model.display_name.trim() ? '' : 'The party needs a name.',
		contact_email: emailError(model.contact_email),
		contact_phone: phoneError(model.contact_phone),
		contact_warn: phoneWarning(model.contact_phone)
	});

	const valid = $derived(
		!topErrors.display_name &&
			!topErrors.contact_email &&
			!topErrors.contact_phone &&
			guestCount > 0 &&
			model.guests.every((g) => {
				const e = rowError(g);
				return !e.name && !e.email && !e.phone;
			})
	);

	/** Guests with a recorded RSVP that the current edit would delete. */
	const removedResponded = $derived(
		party
			? party.guests.filter((g) => g.attending !== null && !model.guests.some((m) => m.id === g.id))
			: []
	);
	function restoreRemoved() {
		for (const g of removedResponded) {
			model.guests.push({
				id: g.id,
				name: g.name,
				email: g.email ?? '',
				phone: g.phone ?? '',
				is_plus_one: g.is_plus_one,
				attending: g.attending,
				meal: g.meal,
				dietary: g.dietary
			});
		}
	}

	// ── guest row mechanics ─────────────────────────────────────────────────
	let formEl = $state<HTMLFormElement>();

	function focusGuest(i: number) {
		formEl?.querySelector<HTMLInputElement>(`[data-g="${i}-name"]`)?.focus();
	}
	async function addGuest() {
		model.guests.push(blankGuest());
		await tick();
		focusGuest(model.guests.length - 1);
	}
	function removeGuest(i: number) {
		const g = model.guests[i];
		model.guests.splice(i, 1);
		rowTouched.delete(g);
		if (!model.guests.length) model.guests.push(blankGuest());
	}
	async function rowEnter(e: KeyboardEvent, i: number) {
		if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
		e.preventDefault();
		if (i === model.guests.length - 1) model.guests.push(blankGuest());
		await tick();
		focusGuest(i + 1);
	}
	function formKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			formEl?.requestSubmit();
		}
	}
	/** Multi-row (or tabbed) paste into a name field fans out into guest rows. */
	function pasteRows(e: ClipboardEvent, i: number) {
		const text = e.clipboardData?.getData('text') ?? '';
		if (!/[\n\t|]/.test(text.trim())) return; // an ordinary paste — leave it alone
		const rows = parsePastedGuests(text);
		if (!rows.length) return;
		e.preventDefault();
		if (isBlankRow(model.guests[i])) model.guests.splice(i, 1, ...rows);
		else model.guests.splice(i + 1, 0, ...rows);
		notify(`Filled ${rows.length} guest ${rows.length === 1 ? 'row' : 'rows'} from the paste.`);
	}

	// ── save / delete ───────────────────────────────────────────────────────
	let saving = $state(false);
	let deleting = $state(false);
	let justSaved = $state(false);
	let serverError = $state('');
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	export function requestSave() {
		formEl?.requestSubmit();
	}

	const handleSave: SubmitFunction = ({ cancel }) => {
		attempted = true;
		serverError = '';
		if (!valid) {
			cancel();
			return;
		}
		saving = true;
		return async ({ result }) => {
			saving = false;
			const name = model.display_name.trim();
			if (result.type === 'success') {
				await invalidateAll();
				if (party) {
					model = fromParty(party);
					baseline = snap(model);
					attempted = false;
					justSaved = true;
					clearTimeout(savedTimer);
					savedTimer = setTimeout(() => (justSaved = false), 2500);
				}
				onSaved?.(name);
			} else if (result.type === 'failure') {
				serverError =
					(result.data as { partyError?: string } | undefined)?.partyError ??
					'The party was not saved.';
			} else if (result.type === 'error') {
				serverError = 'Connection trouble — nothing was saved. Your entries are still here; try again.';
			}
		};
	};

	const handleDelete: SubmitFunction = () => {
		deleting = true;
		return async ({ result }) => {
			deleting = false;
			if (result.type === 'success') {
				notify(`Deleted ${model.display_name.trim() || 'the party'}.`);
				await invalidateAll();
			} else {
				notify('Delete failed — try again.', 'err');
			}
		};
	};
</script>

<div class="editor">
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions — keydown is the ⌘↵ save shortcut -->
	<form
		method="POST"
		action="?/saveParty"
		use:enhance={handleSave}
		bind:this={formEl}
		onkeydown={formKeydown}
		novalidate
	>
		{#if party}<input type="hidden" name="id" value={party.id} />{/if}
		<input type="hidden" name="guests_json" value={guestsJson} />

		<div class="top-grid">
			<label class="f name">
				<span>Party name</span>
				<input
					name="display_name"
					bind:value={model.display_name}
					placeholder="The Smith party"
					class:bad={showTop('display_name') && topErrors.display_name}
					onblur={() => touchTop('display_name')}
				/>
				{#if showTop('display_name') && topErrors.display_name}
					<em class="f-err">{topErrors.display_name}</em>
				{/if}
			</label>
			<label class="f">
				<span>Contact email</span>
				<input
					name="contact_email"
					type="email"
					bind:value={model.contact_email}
					placeholder="household@example.com"
					class:bad={showTop('contact_email') && topErrors.contact_email}
					onblur={() => touchTop('contact_email')}
				/>
				{#if showTop('contact_email') && topErrors.contact_email}
					<em class="f-err">{topErrors.contact_email}</em>
				{/if}
			</label>
			<label class="f">
				<span>Contact phone</span>
				<input
					name="contact_phone"
					type="tel"
					bind:value={model.contact_phone}
					placeholder="+12055551234"
					class:bad={showTop('contact_phone') && topErrors.contact_phone}
					onblur={() => touchTop('contact_phone')}
				/>
				{#if showTop('contact_phone') && topErrors.contact_phone}
					<em class="f-err">{topErrors.contact_phone}</em>
				{:else if showTop('contact_phone') && topErrors.contact_warn}
					<em class="f-warn">{topErrors.contact_warn}</em>
				{/if}
			</label>
		</div>

		<div class="guests">
			<div class="g-cols" aria-hidden="true">
				<span>Guest</span><span>Email</span><span>Phone</span><span>+1</span><span></span>
			</div>
			{#each model.guests as g, i (g)}
				{@const err = rowError(g)}
				<div class="g-row">
					<input
						aria-label="Guest name"
						placeholder={g.is_plus_one ? 'Unnamed plus-one' : 'Full name'}
						bind:value={g.name}
						data-g="{i}-name"
						class:bad={showRow(g, 'name') && err.name}
						onkeydown={(e) => rowEnter(e, i)}
						onpaste={(e) => pasteRows(e, i)}
						onblur={() => touchRow(g, 'name')}
					/>
					<input
						aria-label="Guest email"
						type="email"
						placeholder="email"
						bind:value={g.email}
						class:bad={showRow(g, 'email') && err.email}
						onkeydown={(e) => rowEnter(e, i)}
						onblur={() => touchRow(g, 'email')}
					/>
					<input
						aria-label="Guest phone"
						type="tel"
						placeholder="+1…"
						bind:value={g.phone}
						class:bad={showRow(g, 'phone') && err.phone}
						onkeydown={(e) => rowEnter(e, i)}
						onblur={() => touchRow(g, 'phone')}
					/>
					<label class="g-plus" title="An open plus-one seat — the guest fills in the name">
						<input type="checkbox" bind:checked={g.is_plus_one} />
						<span>+1</span>
					</label>
					<button type="button" class="g-x" aria-label="Remove guest row" onclick={() => removeGuest(i)}>
						×
					</button>
					{#if g.id && g.attending !== null && g.attending !== undefined}
						<div class="g-rsvp" class:declines={g.attending === false}>
							{g.attending ? 'accepts' : 'declines'}{g.attending && g.meal ? ` · ${g.meal}` : ''}{g.dietary
								? ` · ${g.dietary}`
								: ''}
						</div>
					{/if}
					{#if (showRow(g, 'name') && err.name) || (showRow(g, 'email') && err.email) || (showRow(g, 'phone') && err.phone)}
						<em class="f-err g-note">
							{(showRow(g, 'name') && err.name) ||
								(showRow(g, 'email') && err.email) ||
								(showRow(g, 'phone') && err.phone)}
						</em>
					{:else if showRow(g, 'phone') && err.warn}
						<em class="f-warn g-note">{err.warn}</em>
					{/if}
				</div>
			{/each}
			<div class="g-actions">
				<button type="button" class="mini-btn" onclick={addGuest}>+ Add guest</button>
				<span class="g-hint">
					Enter adds the next guest · paste a spreadsheet list straight into a name field
				</span>
			</div>
			{#if attempted && guestCount === 0}<em class="f-err">Add at least one guest.</em>{/if}
		</div>

		<label class="f">
			<span>Private notes</span>
			<input name="notes" bind:value={model.notes} placeholder="Only we see these" />
		</label>

		{#if removedResponded.length}
			<p class="warn-line">
				Saving removes {removedResponded.map((g) => g.name || 'an unnamed plus-one').join(', ')} —
				their RSVP goes with them.
				<button type="button" class="mini-btn" onclick={restoreRemoved}>Put them back</button>
			</p>
		{/if}

		{#if serverError}<p class="form-err" role="alert">{serverError}</p>{/if}

		<div class="foot">
			<button class="save-btn" type="submit" disabled={saving || (!!party && !dirty)}>
				{saving ? 'Saving…' : justSaved ? 'Saved ✓' : party ? 'Save changes' : 'Create party'}
			</button>
			{#if party && dirty}<span class="dirty-note">Unsaved changes</span>{/if}
			{#if onDiscard}
				<ConfirmButton
					label="Discard draft"
					confirmLabel="Yes, discard"
					kind="quiet"
					small
					onConfirm={onDiscard}
				/>
			{/if}
		</div>
	</form>

	{#if party}
		<form method="POST" action="?/deleteParty" use:enhance={handleDelete} class="del-form">
			<input type="hidden" name="id" value={party.id} />
			<ConfirmButton
				label="Delete party"
				confirmLabel="Yes, delete"
				message="Their guests and any RSVP go too."
				kind="danger"
				small
				busy={deleting}
				busyLabel="Deleting…"
			/>
		</form>
	{/if}
</div>

<style>
	.editor {
		display: grid;
		gap: 1rem;
	}
	form {
		display: grid;
		gap: 0.9rem;
	}
	.top-grid {
		display: grid;
		grid-template-columns: 1.4fr 1.2fr 1fr;
		gap: 0.8rem;
	}
	.f {
		display: grid;
		gap: 0.3rem;
		align-content: start;
	}
	.f > span {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	input:not([type='checkbox']) {
		background: rgba(0, 0, 0, 0.18);
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.5rem 0.7rem;
		font-family: var(--body);
		font-size: 0.95rem;
		width: 100%;
		min-width: 0;
		transition: border-color 0.2s ease;
	}
	input:not([type='checkbox']):focus {
		outline: none;
		border-color: var(--candle);
	}
	input.bad {
		border-color: rgba(201, 159, 148, 0.75);
	}
	input::placeholder {
		color: var(--ink-faint);
		opacity: 0.6;
	}
	.f-err {
		color: var(--blush);
		font-style: normal;
		font-size: 0.85rem;
	}
	.f-warn {
		color: var(--candle);
		font-style: normal;
		font-size: 0.85rem;
	}
	.form-err {
		color: var(--blush);
		border: 1px solid rgba(201, 159, 148, 0.35);
		padding: 0.5rem 0.8rem;
		margin: 0;
	}
	.warn-line {
		color: var(--candle);
		font-size: 0.88rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* guest rows */
	.guests {
		display: grid;
		gap: 0.45rem;
		border: 1px solid var(--line);
		padding: 0.8rem;
		background: rgba(0, 0, 0, 0.12);
	}
	.g-cols,
	.g-row {
		display: grid;
		grid-template-columns: 1.5fr 1.5fr 1fr auto 1.8rem;
		gap: 0.3rem 0.55rem;
		align-items: center;
	}
	.g-cols span {
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.g-plus {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--ink-muted);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0 0.2rem;
	}
	.g-plus input {
		accent-color: var(--claret);
	}
	.g-x {
		background: none;
		border: none;
		color: var(--ink-faint);
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.3rem;
		transition: color 0.2s ease;
	}
	.g-x:hover {
		color: var(--blush);
	}
	.g-rsvp {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		color: #9db07f;
		padding-left: 0.2rem;
	}
	.g-rsvp.declines {
		color: var(--blush);
	}
	.g-note {
		grid-column: 1 / -1;
		padding-left: 0.2rem;
	}
	.g-actions {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		flex-wrap: wrap;
		margin-top: 0.3rem;
	}
	.g-hint {
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	.mini-btn {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: var(--body);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}
	.mini-btn:hover {
		border-color: var(--candle);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
	}
	.save-btn {
		background: var(--claret);
		color: var(--parchment);
		border: 1px solid var(--claret);
		font-family: var(--body);
		font-size: 0.76rem;
		letter-spacing: 0.12em;
		text-indent: 0.12em;
		text-transform: uppercase;
		padding: 0.75rem 1.6rem;
		cursor: pointer;
		transition: background 0.25s ease;
	}
	.save-btn:hover:not(:disabled) {
		background: var(--burgundy);
	}
	.save-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.dirty-note {
		color: var(--candle);
		font-size: 0.85rem;
	}
	.del-form {
		justify-self: start;
	}

	@media (max-width: 760px) {
		.top-grid {
			grid-template-columns: 1fr;
		}
		.g-cols {
			display: none;
		}
		.g-row {
			grid-template-columns: 1fr auto 1.8rem;
			border: 1px solid var(--line);
			padding: 0.55rem;
		}
		.g-row input[aria-label='Guest name'] {
			grid-column: 1 / 2;
		}
		.g-row input[aria-label='Guest email'],
		.g-row input[aria-label='Guest phone'] {
			grid-column: 1 / -1;
		}
	}
</style>
