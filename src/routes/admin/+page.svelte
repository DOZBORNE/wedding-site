<script lang="ts">
	import { enhance } from '$app/forms';
	import { MEALS } from '$lib/config';
	import type { Guest } from '$lib/types';

	let { data, form } = $props();

	const guestsToLines = (guests: Guest[]) =>
		guests
			.map((g) => {
				const name = g.is_plus_one ? (g.name ? `${g.name} *` : '*') : g.name;
				const parts = [name];
				if (g.email || g.phone) parts.push(g.email ?? '');
				if (g.phone) parts.push(g.phone ?? '');
				return parts.join(' | ');
			})
			.join('\n');

	let stats = $derived.by(() => {
		if (!data.authed) return null;
		const guests = data.parties.flatMap((p) => p.guests);
		const accepted = guests.filter((g) => g.attending === true);
		const meals = Object.fromEntries(
			MEALS.map((m) => [m, accepted.filter((g) => g.meal === m).length])
		);
		return {
			parties: data.parties.length,
			invited: data.parties.filter((p) => p.invited_at).length,
			responded: data.parties.filter((p) => p.responded_at).length,
			guests: guests.length,
			accepted: accepted.length,
			declined: guests.filter((g) => g.attending === false).length,
			pending: guests.filter((g) => g.attending === null).length,
			meals
		};
	});
</script>

<svelte:head><title>Admin — wedding</title></svelte:head>

<main class="admin">
	{#if !data.authed}
		<div class="login">
			<h1>The back room</h1>
			<form method="POST" action="?/login" use:enhance>
				<label for="pw">Password</label>
				<input id="pw" name="password" type="password" autocomplete="current-password" />
				{#if form && 'loginError' in form && form.loginError}<p class="err">{form.loginError}</p>{/if}
				<button class="claret-btn" type="submit">Enter</button>
			</form>
		</div>
	{:else}
		<header class="bar">
			<h1>Wedding admin</h1>
			<form method="POST" action="?/logout" use:enhance>
				<button class="ghost-btn small" type="submit">Log out</button>
			</form>
		</header>

		{#if stats}
			<section class="stats">
				<div><b>{stats.parties}</b><span>parties</span></div>
				<div><b>{stats.invited}</b><span>invited</span></div>
				<div><b>{stats.responded}</b><span>responded</span></div>
				<div><b>{stats.guests}</b><span>guests invited</span></div>
				<div class="good"><b>{stats.accepted}</b><span>accepting</span></div>
				<div class="bad"><b>{stats.declined}</b><span>declining</span></div>
				<div><b>{stats.pending}</b><span>pending</span></div>
				{#each MEALS as meal (meal)}
					<div><b>{stats.meals[meal]}</b><span>{meal.toLowerCase()}</span></div>
				{/each}
			</section>
		{/if}

		<section class="panel">
			<h2>Invitations</h2>
			<p class="hint">
				Sends the invitation email to each party's contact (plus any per-guest contacts).
				Defaults to parties <b>not yet invited</b>, so re-running won't double-send.
				{#if data.smsConfigured}Texts go to parties with a phone number.{:else}
					<i>SMS is off until Twilio is configured.</i>{/if}
			</p>
			<form method="POST" action="?/invite" use:enhance>
				<label class="inline">
					Who
					<select name="audience">
						<option value="uninvited">Parties not yet invited</option>
						<option value="all">Everyone (re-send)</option>
					</select>
				</label>
				{#if data.smsConfigured}
					<label class="check"><input type="checkbox" name="sms" checked /> also send texts</label>
				{/if}
				<button
					class="claret-btn"
					type="submit"
					onclick={(e) => {
						if (!confirm('Send invitations now?')) e.preventDefault();
					}}
				>
					Send invitations
				</button>
			</form>
			{#if form && 'inviteResult' in form && form.inviteResult}
				<p class="ok">
					Invited {form.inviteResult.parties} parties — {form.inviteResult.emails} emails,
					{form.inviteResult.texts} texts.
				</p>
				{#if form.inviteResult.failed}
					<p class="err">
						{form.inviteResult.failed} email(s) failed. First error: {form.inviteResult.error}
					</p>
				{/if}
				{#if form.inviteResult.parties === 0}
					<p class="hint">
						<i>No parties matched — either everyone's already invited, or no parties have a contact
						email. Add emails, or choose "Everyone (re-send)".</i>
					</p>
				{/if}
			{/if}
			{#if form && 'inviteError' in form && form.inviteError}<p class="err">{form.inviteError}</p>{/if}
		</section>

		<section class="panel">
			<h2>Reminders</h2>
			<p class="hint">
				Emails every party that hasn't responded (needs a contact email on the party).
				{#if data.smsConfigured}Texts go to parties with a phone number.{:else}
					<i>SMS is not configured — add the Twilio keys to .env to enable texts.</i>{/if}
			</p>
			<form method="POST" action="?/remind" use:enhance>
				{#if data.smsConfigured}
					<label class="check"><input type="checkbox" name="sms" checked /> also send texts</label>
				{/if}
				<button
					class="claret-btn"
					type="submit"
					onclick={(e) => {
						if (!confirm('Send reminders to every party that has not responded?')) e.preventDefault();
					}}
				>
					Send reminders now
				</button>
			</form>
			{#if form && 'remindResult' in form && form.remindResult}
				<p class="ok">
					Nudged {form.remindResult.parties} parties — {form.remindResult.emails} emails,
					{form.remindResult.texts} texts.
					{#if form.remindResult.skipped}
						({form.remindResult.skipped} skipped — reminded in the last 48h.){/if}
				</p>
			{/if}
			{#if form && 'remindError' in form && form.remindError}<p class="err">{form.remindError}</p>{/if}
		</section>

		<section class="panel">
			<h2>Send an update</h2>
			<p class="hint">
				Emails (and texts) a message to a group of parties — venue changes, booking news, schedule.
				Goes to each party's contact plus any per-guest contacts.
				{#if !data.smsConfigured}<i>SMS is off until Twilio is configured.</i>{/if}
			</p>
			<form method="POST" action="?/broadcast" use:enhance class="party-form">
				<label>Subject <input name="subject" placeholder="A small change to our plans" required /></label>
				<label>
					Message
					<textarea name="message" rows="4" placeholder="Write your update here…" required></textarea>
				</label>
				<label>
					Who receives it
					<select name="audience">
						<option value="all">Everyone</option>
						<option value="responded">Only parties who responded</option>
						<option value="attending">Only parties attending</option>
						<option value="pending">Only parties who haven't responded</option>
					</select>
				</label>
				<label>
					How
					<select name="channel">
						<option value="email">Email only</option>
						{#if data.smsConfigured}
							<option value="sms">Text only</option>
							<option value="both">Email &amp; text</option>
						{/if}
					</select>
				</label>
				<button
					class="claret-btn"
					type="submit"
					onclick={(e) => {
						if (!confirm('Send this update now?')) e.preventDefault();
					}}
				>
					Send update
				</button>
			</form>
			{#if form && 'broadcastResult' in form && form.broadcastResult}
				<p class="ok">
					Sent to {form.broadcastResult.recipients} parties — {form.broadcastResult.emails} emails,
					{form.broadcastResult.texts} texts.
				</p>
			{/if}
			{#if form && 'broadcastError' in form && form.broadcastError}
				<p class="err">{form.broadcastError}</p>
			{/if}
		</section>

		<section class="panel">
			<h2>Parties ({data.parties.length})</h2>
			{#if form && 'partyError' in form && form.partyError}<p class="err">{form.partyError}</p>{/if}

			<details class="party new">
				<summary>+ New party</summary>
				<form method="POST" action="?/saveParty" use:enhance class="party-form">
					<label>Party name <input name="display_name" placeholder="The Smith Party" required /></label>
					<label>Contact email <input name="contact_email" type="email" /></label>
					<label>Contact phone <input name="contact_phone" placeholder="+1205…" /></label>
					<label>
						Guests — one per line. Optional contact after pipes: <code>Name | email | phone</code>.
						End a line with * for a plus-one slot (or a line with just *).
						<textarea
							name="guests"
							rows="4"
							placeholder={'Jordan Smith | jordan@example.com | +12055551234\nAlex Smith\n*'}
							required
						></textarea>
					</label>
					<label>Private notes <input name="notes" /></label>
					<button class="claret-btn" type="submit">Create party</button>
				</form>
			</details>

			{#each data.parties as party (party.id)}
				<details class="party">
					<summary>
						<span class="p-name">{party.display_name}</span>
						<span class="p-meta">
							code <code>{party.code}</code>
							· {party.guests.length} guests
							{#if !party.invited_at}· <span class="pending-inline">not invited</span>{/if}
							{#if party.responded_at}
								· <span class="ok-inline">responded</span>
							{:else}
								· <span class="pending-inline">pending</span>
							{/if}
						</span>
					</summary>

					<div class="p-body">
						<table class="g-table">
							<thead><tr><th>Guest</th><th>Reply</th><th>Meal</th><th>Dietary</th></tr></thead>
							<tbody>
								{#each party.guests as g (g.id)}
									<tr>
										<td>{g.name || '(unclaimed plus-one)'}{g.is_plus_one ? ' *' : ''}</td>
										<td>
											{g.attending === true ? 'accepts' : g.attending === false ? 'declines' : '—'}
										</td>
										<td>{g.meal || '—'}</td>
										<td>{g.dietary || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						{#if party.song_requests}<p class="hint">Songs: {party.song_requests}</p>{/if}
						{#if party.message}<p class="hint">Note: “{party.message}”</p>{/if}
						<p class="hint">
							RSVP link: <code>/rsvp?code={party.code}</code>
							{#if party.reminded_at}· last reminded {new Date(party.reminded_at).toLocaleDateString()}{/if}
						</p>

						<form method="POST" action="?/saveParty" use:enhance class="party-form">
							<input type="hidden" name="id" value={party.id} />
							<label>Party name <input name="display_name" value={party.display_name} required /></label>
							<label>Contact email <input name="contact_email" type="email" value={party.contact_email} /></label>
							<label>Contact phone <input name="contact_phone" value={party.contact_phone} /></label>
							<label>
								Guest list — <code>Name | email | phone</code>, * for a plus-one
								<textarea name="guests" rows="4">{guestsToLines(party.guests)}</textarea>
							</label>
							<label class="check">
								<input type="checkbox" name="replace_guests" />
								replace guest list (resets this party's responses)
							</label>
							<label>Private notes <input name="notes" value={party.notes} /></label>
							<div class="row-btns">
								<button class="claret-btn" type="submit">Save</button>
							</div>
						</form>
						<form
							method="POST"
							action="?/deleteParty"
							use:enhance
							onsubmit={(e) => {
								if (!confirm(`Delete ${party.display_name}? This removes their RSVP too.`))
									e.preventDefault();
							}}
						>
							<input type="hidden" name="id" value={party.id} />
							<button class="danger" type="submit">Delete party</button>
						</form>
					</div>
				</details>
			{/each}
		</section>

		<section class="panel">
			<h2>Guestbook ({data.notes.length})</h2>
			{#each data.notes as note (note.id)}
				<div class="note" class:pending={!note.approved}>
					<p>“{note.message}” <b>— {note.name}</b></p>
					<div class="note-actions">
						<form method="POST" action="?/setNote" use:enhance>
							<input type="hidden" name="id" value={note.id} />
							<input type="hidden" name="do" value={note.approved ? 'unapprove' : 'approve'} />
							<button type="submit">{note.approved ? 'Hide' : 'Approve'}</button>
						</form>
						<form method="POST" action="?/setNote" use:enhance>
							<input type="hidden" name="id" value={note.id} />
							<input type="hidden" name="do" value="delete" />
							<button type="submit" class="danger">Delete</button>
						</form>
					</div>
				</div>
			{:else}
				<p class="hint">No notes yet.</p>
			{/each}
		</section>
	{/if}
</main>

<style>
	.admin {
		max-width: 900px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 5rem;
		display: grid;
		gap: 2rem;
	}
	h1 {
		font-size: 1.8rem;
		color: var(--parchment);
	}
	h2 {
		font-size: 1.3rem;
		color: var(--parchment);
		margin-bottom: 0.8rem;
	}
	.login {
		min-height: 60vh;
		display: grid;
		place-content: center;
		gap: 1rem;
		text-align: center;
	}
	.login form {
		display: grid;
		gap: 0.8rem;
		justify-items: center;
	}
	.login input {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.6rem 0.9rem;
		font-family: var(--body);
		font-size: 1rem;
	}
	.login label {
		font-size: 0.72rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid var(--line);
		padding-bottom: 1rem;
	}
	.small {
		padding: 0.5rem 1.2rem;
		font-size: 0.7rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}
	.stats > div {
		background: var(--espresso);
		padding: 0.9rem 0.6rem;
		text-align: center;
		display: grid;
		gap: 0.1rem;
	}
	.stats b {
		font-family: var(--display);
		font-size: 1.5rem;
		color: var(--parchment);
		font-weight: 400;
	}
	.stats span {
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.stats .good b {
		color: #9db07f;
	}
	.stats .bad b {
		color: var(--blush);
	}
	.panel {
		border: 1px solid var(--line);
		padding: 1.4rem;
		background: rgba(34, 26, 20, 0.5);
	}
	.hint {
		color: var(--ink-faint);
		font-size: 0.95rem;
		margin: 0.3rem 0;
	}
	.ok {
		color: #9db07f;
	}
	.ok-inline {
		color: #9db07f;
	}
	.pending-inline {
		color: var(--candle);
	}
	.err {
		color: var(--blush);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		color: var(--ink-muted);
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--ink-muted);
		margin-right: 1rem;
	}
	.inline select {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.4rem 0.6rem;
		font-family: var(--body);
		font-size: 0.95rem;
	}
	.party {
		border-top: 1px solid var(--line);
		padding: 0.6rem 0;
	}
	.party.new {
		border: 1px dashed var(--line);
		padding: 0.6rem 0.9rem;
		margin-bottom: 1rem;
	}
	.party summary {
		cursor: pointer;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		align-items: baseline;
		padding: 0.4rem 0;
	}
	.p-name {
		font-family: var(--display);
		font-size: 1.1rem;
		color: var(--parchment);
	}
	.p-meta {
		font-size: 0.85rem;
		color: var(--ink-faint);
	}
	.p-meta code,
	.hint code {
		color: var(--candle);
		font-size: 0.85em;
	}
	.p-body {
		padding: 0.6rem 0 1rem;
		display: grid;
		gap: 0.9rem;
	}
	.g-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	.g-table th {
		text-align: left;
		font-size: 0.66rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--ink-faint);
		font-weight: 400;
		padding: 0.3rem 0.6rem 0.3rem 0;
		border-bottom: 1px solid var(--line);
	}
	.g-table td {
		padding: 0.4rem 0.6rem 0.4rem 0;
		border-bottom: 1px solid rgba(230, 217, 198, 0.07);
		color: var(--ink-on-dark);
	}
	.party-form {
		display: grid;
		gap: 0.7rem;
	}
	.party-form label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		color: var(--ink-muted);
	}
	.party-form input:not([type='checkbox']),
	.party-form textarea {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.5rem 0.7rem;
		font-family: var(--body);
		font-size: 1rem;
	}
	.row-btns {
		display: flex;
		gap: 0.8rem;
	}
	.danger {
		background: none;
		border: 1px solid rgba(201, 159, 148, 0.4);
		color: var(--blush);
		font-family: var(--body);
		font-size: 0.75rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		padding: 0.5rem 1rem;
		cursor: pointer;
	}
	.note {
		border-top: 1px solid var(--line);
		padding: 0.8rem 0;
		display: grid;
		gap: 0.5rem;
	}
	.note.pending {
		background: rgba(227, 184, 127, 0.05);
	}
	.note p {
		margin: 0;
		font-style: italic;
		color: var(--ink-on-dark);
	}
	.note b {
		font-style: normal;
		font-weight: 400;
		color: var(--ink-faint);
	}
	.note-actions {
		display: flex;
		gap: 0.6rem;
	}
	.note-actions button {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: var(--body);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
	}
	.note-actions .danger {
		border-color: rgba(201, 159, 148, 0.4);
		color: var(--blush);
	}
</style>
