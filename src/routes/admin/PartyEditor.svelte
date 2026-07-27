<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ConfirmButton from './ConfirmButton.svelte';
	import PhoneInput from './PhoneInput.svelte';
	import { toE164 } from '$lib/phone';
	import { blankAddress } from '$lib/types';
	import {
		ADDRESS_FIELDS,
		blankGuest,
		emailError,
		isBlankRow,
		parsePastedGuests,
		phoneError,
		pickAddress,
		type AdminPartyView,
		type GuestDraft,
		type PartyDraft
	} from './party-form';

	let {
		party = null,
		draft = null,
		smsConfigured = false,
		notify = () => {},
		onSaved,
		onDiscard,
		onDirty
	}: {
		/** Edit mode: the stored party this editor works on a local copy of. */
		party?: AdminPartyView | null;
		/** Draft mode: a page-owned draft object, mutated in place so the page can persist it. */
		draft?: PartyDraft | null;
		/** Twilio is wired up — without it the text button has nothing to send through. */
		smsConfigured?: boolean;
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
		address: pickAddress(p),
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
	// A draft saved before addresses existed won't have one — fill it in rather than crash.
	if (!initial.address) initial.address = blankAddress();
	let model = $state<PartyDraft>(initial);

	/** Phones are stored as +E.164 so Twilio never has to guess. */
	const canonPhone = (v: string) => toE164(v) || v.trim();

	/** What actually gets saved — trimmed, blank rows dropped, RSVP fields stripped. */
	const snapGuests = (m: PartyDraft) =>
		m.guests
			.filter((g) => !isBlankRow(g))
			.map((g) => ({
				id: g.id,
				name: g.name.trim(),
				email: g.email.trim(),
				phone: canonPhone(g.phone),
				is_plus_one: g.is_plus_one
			}));
	const snap = (m: PartyDraft) =>
		JSON.stringify({
			display_name: m.display_name.trim(),
			contact_email: m.contact_email.trim(),
			contact_phone: canonPhone(m.contact_phone),
			notes: m.notes.trim(),
			address: pickAddress(m.address),
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
	const addressFilled = $derived(ADDRESS_FIELDS.some((f) => model.address[f].trim()));

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
			? { name: '', email: '', phone: '' }
			: {
					name:
						!g.is_plus_one && !g.name.trim()
							? 'Give this guest a name, or mark the row as a plus-one.'
							: '',
					email: emailError(g.email),
					phone: phoneError(g.phone)
				};

	const topErrors = $derived({
		display_name: model.display_name.trim() ? '' : 'The party needs a name.',
		contact_email: emailError(model.contact_email),
		contact_phone: phoneError(model.contact_phone)
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

	// ── sending to this one party ───────────────────────────────────────────
	// Counted off the *stored* party, not the working copy: the server sends to
	// what's saved, so a contact typed a moment ago doesn't count until it is.
	const contacts = (values: (string | null | undefined)[]) => [
		...new Set(
			values
				.map((v) => (v ?? '').trim().toLowerCase())
				.filter(Boolean)
		)
	];
	const emailTargets = $derived(
		party ? contacts([party.contact_email, ...party.guests.map((g) => g.email)]) : []
	);
	const phoneTargets = $derived(
		party ? contacts([party.contact_phone, ...party.guests.map((g) => g.phone)]) : []
	);
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	let sending = $state<'' | 'email' | 'sms'>('');

	const handleSend =
		(channel: 'email' | 'sms'): SubmitFunction =>
		() => {
			sending = channel;
			return async ({ result }) => {
				sending = '';
				if (result.type === 'success') {
					const r = (result.data as { sendOneResult: { emails: number; texts: number } })
						.sendOneResult;
					notify(
						channel === 'email'
							? `Invitation emailed to ${plural(r.emails, 'address', 'addresses')}.`
							: `Invitation texted to ${plural(r.texts, 'number', 'numbers')}.`
					);
					await invalidateAll();
				} else if (result.type === 'failure') {
					notify(
						(result.data as { sendOneError?: string } | undefined)?.sendOneError ??
							'The send failed.',
						'err'
					);
				} else {
					notify('Connection trouble — check the messages log before re-sending.', 'err');
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
				<PhoneInput
					name="contact_phone"
					bind:value={model.contact_phone}
					placeholder="(205) 555-1234"
					invalid={showTop('contact_phone') && !!topErrors.contact_phone}
					onblur={() => touchTop('contact_phone')}
				/>
				{#if showTop('contact_phone') && topErrors.contact_phone}
					<em class="f-err">{topErrors.contact_phone}</em>
				{:else if !model.contact_phone}
					<em class="f-note">US by default — for anywhere else, type + and the country code.</em>
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
					<PhoneInput
						ariaLabel="Guest phone"
						placeholder="phone"
						bind:value={g.phone}
						invalid={showRow(g, 'phone') && !!err.phone}
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

		<div class="addr">
			<div class="addr-head">
				<span>Mailing address</span>
				<em>
					{addressFilled ? 'On file' : 'Blank — guests fill this in when they RSVP'}
				</em>
			</div>
			<div class="addr-grid">
				<label class="f wide">
					<span>Street</span>
					<input
						name="address_line1"
						bind:value={model.address.address_line1}
						placeholder="123 Magnolia Lane"
					/>
				</label>
				<label class="f wide">
					<span>Apt / suite</span>
					<input name="address_line2" bind:value={model.address.address_line2} placeholder="Apt 4B" />
				</label>
				<label class="f">
					<span>City</span>
					<input name="city" bind:value={model.address.city} placeholder="Birmingham" />
				</label>
				<label class="f">
					<span>State</span>
					<input name="state_region" bind:value={model.address.state_region} placeholder="Alabama" />
				</label>
				<label class="f">
					<span>ZIP</span>
					<input name="postal_code" bind:value={model.address.postal_code} placeholder="35203" />
				</label>
				<label class="f">
					<span>Country</span>
					<input name="country" bind:value={model.address.country} placeholder="United States" />
				</label>
			</div>
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
		<div class="tail">
			<!-- Sending to one household — a resend for a bounced address, or the first
			     copy for a party added after the batch went out. Deliberately quiet:
			     the batch runs further down the page are the usual way to do this. -->
			<div class="send-row">
				<span class="tail-label">Send invitation</span>
				<form method="POST" action="?/sendOne" use:enhance={handleSend('email')}>
					<input type="hidden" name="id" value={party.id} />
					<input type="hidden" name="channel" value="email" />
					<ConfirmButton
						label="Email"
						confirmLabel="Yes, email"
						message="Goes to {plural(emailTargets.length, 'address', 'addresses')} on file."
						kind="quiet"
						confirmKind="primary"
						small
						busy={sending === 'email'}
						busyLabel="Sending…"
						disabled={!emailTargets.length || !!sending}
					/>
				</form>
				<form method="POST" action="?/sendOne" use:enhance={handleSend('sms')}>
					<input type="hidden" name="id" value={party.id} />
					<input type="hidden" name="channel" value="sms" />
					<ConfirmButton
						label="Text"
						confirmLabel="Yes, text"
						message="Goes to {plural(phoneTargets.length, 'number', 'numbers')} on file."
						kind="quiet"
						confirmKind="primary"
						small
						busy={sending === 'sms'}
						busyLabel="Sending…"
						disabled={!smsConfigured || !phoneTargets.length || !!sending}
					/>
				</form>
				<span class="tail-note">
					{#if !emailTargets.length && !phoneTargets.length}
						No contact on file for this party.
					{:else if !smsConfigured && !emailTargets.length}
						Only a phone number here, and texting is off.
					{:else if dirty}
						Sends the saved details — save first if you changed a contact.
					{:else if party.invited_at}
						Already invited — this sends it again.
					{/if}
				</span>
			</div>

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
		</div>
	{/if}
</div>

<style>
	/* The editor is a sheet of paper laid on the dark desk — the same parchment the
	   RSVP card is printed on. It's the one surface here that gets read and typed
	   into for an hour at a stretch, so it trades candlelight for ink-on-paper
	   contrast.

	   The dark-theme tokens are re-pointed on this element rather than only in the
	   rules below, so the child components (PhoneInput, ConfirmButton) come along
	   without needing a prop each. Everything inside .editor is on paper; nothing
	   outside it is touched. */
	.editor {
		--line: rgba(58, 36, 32, 0.32);
		--ink-on-dark: var(--ink-on-paper);
		--ink-muted: var(--chocolate);
		--ink-faint: #6c5546;
		--candle: var(--claret);
		--blush: #7a1f28;
		--field-bg: rgba(255, 253, 247, 0.55);
		--field-bg-focus: rgba(255, 253, 247, 0.92);

		background: linear-gradient(160deg, var(--parchment) 0%, var(--parchment-deep) 100%);
		color: var(--ink-on-paper);
		box-shadow: inset 0 0 40px rgba(74, 46, 31, 0.1);
		padding: 1.15rem 1.2rem 1.3rem;
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
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-label);
	}
	input:not([type='checkbox']) {
		background: var(--field-bg);
		border: 1px solid rgba(58, 36, 32, 0.35);
		color: var(--ink-on-paper);
		padding: 0.5rem 0.7rem;
		font-family: var(--body);
		font-size: 0.95rem;
		width: 100%;
		min-width: 0;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}
	/* The filled tint deepens on focus as well as the rule changing colour — the
	   field you're in has to be obvious when the row is five boxes wide. */
	input:not([type='checkbox']):focus {
		outline: none;
		border-color: var(--claret);
		background: var(--field-bg-focus);
	}
	input.bad {
		border-color: #7a1f28;
		background: rgba(122, 31, 40, 0.07);
	}
	input::placeholder {
		color: rgba(58, 36, 32, 0.5);
	}
	.f-err {
		color: #6b1a22;
		font-weight: 600;
		font-style: normal;
		font-size: 0.85rem;
	}
	.f-note {
		color: var(--ink-faint);
		font-style: normal;
		font-size: 0.78rem;
	}
	.form-err,
	.warn-line {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #6b1a22;
		background: rgba(122, 31, 40, 0.08);
		border-left: 3px solid #7a1f28;
		padding: 0.55rem 0.8rem;
	}
	.warn-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* mailing address */
	.addr {
		border: 1px solid rgba(58, 36, 32, 0.28);
		padding: 0.8rem;
		background: rgba(255, 253, 247, 0.28);
		display: grid;
		gap: 0.6rem;
	}
	.addr-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.addr-head span {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-label);
	}
	.addr-head em {
		font-style: normal;
		font-size: 0.78rem;
		color: var(--ink-faint);
		opacity: 0.8;
	}
	.addr-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.6rem;
	}
	.addr-grid .wide {
		grid-column: span 2;
	}

	/* guest rows */
	.guests {
		display: grid;
		gap: 0.45rem;
		border: 1px solid rgba(58, 36, 32, 0.28);
		padding: 0.8rem;
		background: rgba(255, 253, 247, 0.28);
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
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-label);
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
		color: rgba(58, 36, 32, 0.55);
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.3rem;
		transition: color 0.2s ease;
	}
	.g-x:hover {
		color: #7a1f28;
	}
	.g-rsvp {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		font-weight: 600;
		color: #3f5526;
		padding-left: 0.2rem;
	}
	.g-rsvp.declines {
		color: #6b1a22;
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
		background: rgba(255, 253, 247, 0.4);
		border: 1px solid rgba(58, 36, 32, 0.4);
		color: var(--chocolate);
		font-family: var(--body);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}
	.mini-btn:hover {
		border-color: var(--claret);
		color: var(--claret);
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
		color: var(--claret);
		font-weight: 600;
		font-size: 0.85rem;
	}

	/* Everything below the save button: the two per-party sends on the left, delete
	   pushed to the far right. Both are secondary to "Save changes" and sized to
	   say so — small, outlined, no fill. */
	.tail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem 1.2rem;
		flex-wrap: wrap;
		border-top: 1px solid rgba(58, 36, 32, 0.22);
		padding-top: 0.9rem;
	}
	.send-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}
	.tail-label {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-label);
		opacity: 0.8;
	}
	.tail-note {
		font-size: 0.8rem;
		color: var(--ink-faint);
	}

	@media (max-width: 760px) {
		.top-grid {
			grid-template-columns: 1fr;
		}
		.addr-grid {
			grid-template-columns: 1fr 1fr;
		}
		.addr-grid .wide {
			grid-column: 1 / -1;
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
		/* the phone field lives in PhoneInput, so it needs :global to reach */
		.g-row :global(input[aria-label='Guest phone']) {
			grid-column: 1 / -1;
		}
	}
</style>
