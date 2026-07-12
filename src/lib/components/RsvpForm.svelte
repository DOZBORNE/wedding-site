<script lang="ts">
	import { MEALS, REGISTRY_URL, WEDDING } from '$lib/config';
	import type { PublicParty } from '$lib/types';
	import Seal from './Seal.svelte';

	let { party = null }: { party?: PublicParty | null } = $props();

	type Row = {
		id: string;
		name: string;
		is_plus_one: boolean;
		attending: boolean;
		meal: string;
		dietary: string;
	};

	// deliberately seed from the prop's initial value — a deep-linked party
	// is server-rendered straight into the form stage
	// svelte-ignore state_referenced_locally
	const initialParty = party;
	let stage = $state<'lookup' | 'form' | 'done'>(initialParty ? 'form' : 'lookup');
	let query = $state('');
	let searching = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');
	let matches = $state<PublicParty[]>([]);
	let selected = $state<PublicParty | null>(initialParty);
	let rows = $state<Row[]>(initialParty ? toRows(initialParty) : []);
	let songRequests = $state('');
	let message = $state('');
	let contactEmail = $state('');

	function toRows(p: PublicParty): Row[] {
		return p.guests.map((g) => ({
			id: g.id,
			name: g.name,
			is_plus_one: g.is_plus_one,
			attending: g.attending ?? true,
			meal: g.meal || MEALS[0],
			dietary: g.dietary
		}));
	}

	function choose(p: PublicParty) {
		selected = p;
		rows = toRows(p);
		stage = 'form';
		errorMsg = '';
	}

	async function lookup(e: SubmitEvent) {
		e.preventDefault();
		errorMsg = '';
		searching = true;
		matches = [];
		try {
			const res = await fetch('/api/rsvp/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			});
			const data = await res.json();
			if (!res.ok) {
				errorMsg = data.error ?? 'Something went wrong — please try again.';
			} else if (!data.parties.length) {
				errorMsg =
					'We couldn’t find that name. Try the name exactly as it appears on your invitation — or reach out to us directly.';
			} else if (data.parties.length === 1) {
				choose(data.parties[0]);
			} else {
				matches = data.parties;
			}
		} catch {
			errorMsg = 'Something went wrong — please check your connection and try again.';
		} finally {
			searching = false;
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!selected) return;
		errorMsg = '';
		submitting = true;
		try {
			const res = await fetch('/api/rsvp/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					partyId: selected.id,
					guests: rows.map((r) => ({
						id: r.id,
						attending: r.attending,
						meal: r.attending ? r.meal : '',
						dietary: r.dietary,
						...(r.is_plus_one ? { name: r.name } : {})
					})),
					songRequests,
					message,
					contactEmail
				})
			});
			const data = await res.json();
			if (!res.ok) {
				errorMsg = data.error ?? 'Could not save your reply — please try again.';
			} else {
				stage = 'done';
			}
		} catch {
			errorMsg = 'Could not save your reply — please check your connection and try again.';
		} finally {
			submitting = false;
		}
	}

	const seatWord = (n: number) =>
		['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][n] ?? String(n);
</script>

{#if stage === 'lookup'}
	<h2 class="card-title">Kindly respond</h2>
	<p class="sub">Enter a name from your invitation to find your party.</p>
	<form class="rsvp-form" onsubmit={lookup}>
		<div class="field">
			<label for="rsvp-lookup">Your invitation</label>
			<input
				id="rsvp-lookup"
				type="text"
				bind:value={query}
				placeholder="the name on your envelope"
				autocomplete="name"
				required
				minlength="3"
			/>
		</div>
		{#if matches.length > 1}
			<div class="matches">
				<div class="matches-label">Which party is yours?</div>
				{#each matches as m (m.id)}
					<button type="button" class="match" onclick={() => choose(m)}>
						<b>{m.display_name}</b>
						<i>{m.guests.map((g) => g.name || 'guest').join(' · ')}</i>
					</button>
				{/each}
			</div>
		{/if}
		{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
		<button class="claret-btn" type="submit" disabled={searching}>
			{searching ? 'Searching…' : 'Find my invitation'}
		</button>
	</form>
{:else if stage === 'form' && selected}
	<h2 class="card-title">Kindly respond</h2>
	<p class="sub">
		{#if selected.responded_at}
			You've already replied — feel free to update your answer below.
		{:else}
			We found your invitation — reply for everyone in your party.
		{/if}
	</p>
	<form class="rsvp-form" onsubmit={submit}>
		<div class="party-box">
			<div class="party-head">
				{selected.display_name}
				<i>{seatWord(rows.length)} {rows.length === 1 ? 'seat' : 'seats'}</i>
			</div>
			{#each rows as row, i (row.id)}
				<div class="guest-row">
					{#if row.is_plus_one}
						<input
							class="plus-name"
							type="text"
							bind:value={rows[i].name}
							placeholder="your guest — their name"
							aria-label="Plus-one name"
						/>
					{:else}
						<span class="g-name">{row.name}</span>
					{/if}
					<div class="g-pills" role="group" aria-label="Attendance for {row.name || 'guest'}">
						<button
							type="button"
							class="pill"
							class:on={row.attending}
							onclick={() => (rows[i].attending = true)}
						>
							Accepts
						</button>
						<button
							type="button"
							class="pill"
							class:on={!row.attending}
							onclick={() => (rows[i].attending = false)}
						>
							Declines
						</button>
					</div>
					{#if row.attending}
						<select class="g-meal" bind:value={rows[i].meal} aria-label="Meal for {row.name || 'guest'}">
							{#each MEALS as meal (meal)}
								<option value={meal}>{meal}</option>
							{/each}
						</select>
						<input
							class="g-diet"
							type="text"
							bind:value={rows[i].dietary}
							placeholder="allergies or dietary needs"
							aria-label="Dietary needs for {row.name || 'guest'}"
						/>
					{/if}
				</div>
			{/each}
		</div>

		<div class="field">
			<label for="rsvp-email">Email for your confirmation</label>
			<input
				id="rsvp-email"
				type="email"
				bind:value={contactEmail}
				placeholder="you@example.com"
				autocomplete="email"
			/>
		</div>
		<div class="field">
			<label for="rsvp-songs">Song requests</label>
			<input
				id="rsvp-songs"
				type="text"
				bind:value={songRequests}
				placeholder="the song that gets you dancing"
			/>
		</div>
		<div class="field">
			<label for="rsvp-message">A note for us</label>
			<textarea id="rsvp-message" rows="2" bind:value={message} placeholder="entirely optional"
			></textarea>
		</div>

		{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
		<button class="claret-btn" type="submit" disabled={submitting}>
			{submitting ? 'Sealing…' : 'Seal & send'}
		</button>
	</form>
{:else}
	<div class="done">
		<div class="done-seal"><Seal size={84} /></div>
		<h2 class="card-title">Sealed &amp; sent</h2>
		<p class="sub">
			Thank you — your reply is safely on its way.
			{#if contactEmail}A confirmation is headed to {contactEmail}.{/if}
		</p>
		<p class="sub"><i>Until {WEDDING.dateLabel} —</i></p>
		<a class="after-link" href={REGISTRY_URL} target="_blank" rel="noopener">
			Looking for our registry? It lives with The Knot ↗
		</a>
	</div>
{/if}

<style>
	.card-title {
		font-size: clamp(1.9rem, 5vw, 2.4rem);
		color: var(--claret);
		text-align: center;
	}
	.sub {
		font-style: italic;
		color: var(--chocolate);
		margin: 0.4rem 0 1.6rem;
		text-align: center;
	}
	.rsvp-form {
		display: grid;
		gap: 1.15rem;
		text-align: left;
	}
	.error {
		margin: 0;
		color: #7a1f28;
		font-style: italic;
	}
	.matches {
		display: grid;
		gap: 0.6rem;
	}
	.matches-label {
		font-size: 0.72rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--chocolate);
	}
	.match {
		border: 1px solid rgba(58, 36, 32, 0.4);
		background: transparent;
		padding: 0.7rem 0.9rem;
		text-align: left;
		cursor: pointer;
		font-family: var(--body);
		display: grid;
		gap: 0.15rem;
		color: var(--ink-on-paper);
	}
	.match:hover {
		background: rgba(58, 36, 32, 0.07);
	}
	.match b {
		font-weight: 600;
	}
	.match i {
		font-size: 0.9rem;
		opacity: 0.75;
	}
	.party-box {
		border: 1px solid rgba(58, 36, 32, 0.35);
		padding: 1.1rem 1.15rem 1.25rem;
		display: grid;
		gap: 1rem;
	}
	.party-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.8rem;
		flex-wrap: wrap;
		font-size: 0.74rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--chocolate);
		border-bottom: 1px solid rgba(58, 36, 32, 0.3);
		padding-bottom: 0.6rem;
	}
	.party-head i {
		font-style: italic;
		text-transform: none;
		letter-spacing: 0.03em;
		font-size: 0.95rem;
	}
	.guest-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.55rem 0.8rem;
		align-items: center;
	}
	.g-name {
		font-size: 1.05rem;
	}
	.plus-name {
		width: 100%;
		background: transparent;
		border: none;
		border-bottom: 1px dashed rgba(58, 36, 32, 0.45);
		font-family: var(--body);
		font-size: 1rem;
		font-style: italic;
		color: var(--ink-on-paper);
		padding: 0.15rem 0.05rem;
	}
	.plus-name:focus {
		outline: none;
		border-bottom-color: var(--claret);
	}
	.g-pills {
		display: flex;
		gap: 0.45rem;
		justify-self: end;
	}
	.pill {
		border: 1px solid rgba(58, 36, 32, 0.4);
		background: transparent;
		font-family: var(--body);
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		color: var(--ink-on-paper);
		padding: 0.32rem 0.75rem;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}
	.pill.on {
		background: var(--claret);
		color: var(--parchment);
		border-color: var(--claret);
	}
	.g-meal {
		font-family: var(--body);
		font-size: 0.9rem;
		color: var(--ink-on-paper);
		background: transparent;
		border: 1px solid rgba(58, 36, 32, 0.4);
		padding: 0.32rem 0.4rem;
	}
	.g-diet {
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(58, 36, 32, 0.3);
		font-family: var(--body);
		font-size: 0.9rem;
		font-style: italic;
		color: var(--ink-on-paper);
		padding: 0.2rem 0.05rem;
	}
	.g-diet:focus {
		outline: none;
		border-bottom-color: var(--claret);
	}
	.g-diet::placeholder,
	.plus-name::placeholder {
		color: rgba(58, 36, 32, 0.4);
	}
	@media (max-width: 560px) {
		.guest-row {
			grid-template-columns: 1fr;
		}
		.g-pills {
			justify-self: start;
		}
	}
	.done {
		text-align: center;
		display: grid;
		gap: 0.6rem;
		justify-items: center;
		padding: 1rem 0 0.5rem;
	}
	.done-seal {
		animation: press 0.5s ease;
	}
	.after-link {
		font-style: italic;
		color: var(--chocolate);
		font-size: 0.98rem;
	}
	@keyframes press {
		0% {
			transform: scale(1.5);
			opacity: 0;
		}
		60% {
			transform: scale(0.92);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
</style>
