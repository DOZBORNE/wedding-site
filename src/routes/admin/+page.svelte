<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { MEALS } from '$lib/config';
	import ConfirmButton from './ConfirmButton.svelte';
	import PartyEditor from './PartyEditor.svelte';
	import { blankParty, type PartyDraft } from './party-form';

	let { data } = $props();

	// ── toasts ──────────────────────────────────────────────────────────────
	type Toast = { id: number; kind: 'ok' | 'err'; text: string };
	let toasts = $state<Toast[]>([]);
	let nextToast = 0;
	function notify(text: string, kind: 'ok' | 'err' = 'ok') {
		const id = ++nextToast;
		toasts.push({ id, kind, text });
		setTimeout(() => dismissToast(id), kind === 'ok' ? 4200 : 9000);
	}
	function dismissToast(id: number) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	// ── login ───────────────────────────────────────────────────────────────
	let loginBusy = $state(false);
	let loginError = $state('');
	const handleLogin: SubmitFunction = () => {
		loginBusy = true;
		loginError = '';
		return async ({ result, update }) => {
			loginBusy = false;
			if (result.type === 'failure') {
				loginError =
					(result.data as { loginError?: string } | undefined)?.loginError ?? 'Wrong password.';
			} else {
				await update();
			}
		};
	};

	// ── stats ───────────────────────────────────────────────────────────────
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

	// ── new-party drafts — kept in localStorage so a refresh loses nothing ──
	const DRAFTS_KEY = 'wed-admin-party-drafts';
	let drafts = $state<PartyDraft[]>([]);
	let draftsLoaded = false;
	let draftSeq = 0;
	$effect(() => {
		if (!data.authed || draftsLoaded) return;
		draftsLoaded = true;
		try {
			const raw = localStorage.getItem(DRAFTS_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as PartyDraft[];
				if (Array.isArray(parsed)) {
					drafts = parsed.filter((d) => d && typeof d.key === 'string' && Array.isArray(d.guests));
				}
			}
		} catch {
			/* a corrupt stash shouldn't block the page */
		}
	});
	$effect(() => {
		const json = JSON.stringify(drafts); // deep read — tracks every keystroke
		if (!draftsLoaded) return;
		localStorage.setItem(DRAFTS_KEY, json);
	});

	let editors = $state<Record<string, PartyEditor | undefined>>({});
	function addDraft() {
		drafts.push(blankParty(`draft-${Date.now()}-${++draftSeq}`));
	}
	function removeDraft(key: string) {
		drafts = drafts.filter((d) => d.key !== key);
		delete editors[key];
	}
	function draftSaved(key: string, name: string) {
		removeDraft(key);
		notify(`Created ${name || 'the party'}.`);
	}
	function saveAllDrafts() {
		for (const d of [...drafts]) editors[d.key]?.requestSave();
	}

	// ── unsaved-edit guard ──────────────────────────────────────────────────
	let dirtyEdits = $state<Record<string, boolean>>({});
	const anyDirty = $derived(Object.values(dirtyEdits).some(Boolean));
	function guardUnload(e: BeforeUnloadEvent) {
		if (anyDirty) e.preventDefault();
	}

	// ── party list filter ───────────────────────────────────────────────────
	let filter = $state('');
	const visibleParties = $derived.by(() => {
		if (!data.authed) return [];
		const q = filter.trim().toLowerCase();
		if (!q) return data.parties;
		return data.parties.filter((p) =>
			[
				p.display_name,
				p.code,
				p.contact_email,
				p.contact_phone,
				...p.guests.flatMap((g) => [g.name, g.email ?? '', g.phone ?? ''])
			].some((s) => s.toLowerCase().includes(q))
		);
	});

	async function copyLink(code: string) {
		try {
			await navigator.clipboard.writeText(`${location.origin}/rsvp?code=${code}`);
			notify('Invite link copied.');
		} catch {
			notify('Couldn’t reach the clipboard — copy the link by hand.', 'err');
		}
	}
	const fmtDate = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	// ── send panels — each holds its own busy/result/error state ────────────
	type InviteResult = { parties: number; emails: number; texts: number; failed: number; error: string };
	type RemindResult = { parties: number; emails: number; texts: number; skipped?: number };
	type BroadcastResult = { recipients: number; emails: number; texts: number };

	let inviteBusy = $state(false);
	let inviteError = $state('');
	let inviteResult = $state<InviteResult | null>(null);
	let inviteAudience = $state<'uninvited' | 'all'>('uninvited');
	const uninvitedCount = $derived(data.authed ? data.parties.filter((p) => !p.invited_at).length : 0);
	const handleInvite: SubmitFunction = () => {
		inviteBusy = true;
		inviteError = '';
		inviteResult = null;
		return async ({ result }) => {
			inviteBusy = false;
			if (result.type === 'success') {
				inviteResult = (result.data as { inviteResult: InviteResult }).inviteResult;
				notify(`Invitations sent — ${inviteResult.emails} emails, ${inviteResult.texts} texts.`);
				await invalidateAll();
			} else if (result.type === 'failure') {
				inviteError =
					(result.data as { inviteError?: string } | undefined)?.inviteError ??
					'Invitation run failed.';
			} else if (result.type === 'error') {
				inviteError = 'Connection trouble — check the messages log before re-running.';
			}
		};
	};

	let remindBusy = $state(false);
	let remindError = $state('');
	let remindResult = $state<RemindResult | null>(null);
	const pendingCount = $derived(data.authed ? data.parties.filter((p) => !p.responded_at).length : 0);
	const handleRemind: SubmitFunction = () => {
		remindBusy = true;
		remindError = '';
		remindResult = null;
		return async ({ result }) => {
			remindBusy = false;
			if (result.type === 'success') {
				remindResult = (result.data as { remindResult: RemindResult }).remindResult;
				notify(`Reminders sent — ${remindResult.emails} emails, ${remindResult.texts} texts.`);
				await invalidateAll();
			} else if (result.type === 'failure') {
				remindError =
					(result.data as { remindError?: string } | undefined)?.remindError ??
					'Reminder run failed.';
			} else if (result.type === 'error') {
				remindError = 'Connection trouble — check the messages log before re-running.';
			}
		};
	};

	let broadcastBusy = $state(false);
	let broadcastError = $state('');
	let broadcastResult = $state<BroadcastResult | null>(null);
	let bcSubject = $state('');
	let bcMessage = $state('');
	const handleBroadcast: SubmitFunction = () => {
		broadcastBusy = true;
		broadcastError = '';
		broadcastResult = null;
		return async ({ result }) => {
			broadcastBusy = false;
			if (result.type === 'success') {
				broadcastResult = (result.data as { broadcastResult: BroadcastResult }).broadcastResult;
				notify(`Update sent to ${broadcastResult.recipients} parties.`);
				bcSubject = '';
				bcMessage = '';
				await invalidateAll();
			} else if (result.type === 'failure') {
				broadcastError =
					(result.data as { broadcastError?: string } | undefined)?.broadcastError ??
					'Broadcast failed.';
			} else if (result.type === 'error') {
				broadcastError = 'Connection trouble — check the messages log before re-running.';
			}
		};
	};
</script>

<svelte:head><title>Admin — wedding</title></svelte:head>
<svelte:window onbeforeunload={guardUnload} />

<main class="admin">
	{#if !data.authed}
		<div class="login">
			<h1>The back room</h1>
			<form method="POST" action="?/login" use:enhance={handleLogin}>
				<label for="pw">Password</label>
				<input id="pw" name="password" type="password" autocomplete="current-password" />
				{#if loginError}<p class="err" role="alert">{loginError}</p>{/if}
				<button class="claret-btn" type="submit" disabled={loginBusy}>
					{loginBusy ? 'Checking…' : 'Enter'}
				</button>
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
			<div class="panel-head">
				<h2>Parties ({data.parties.length})</h2>
				<div class="head-tools">
					<input
						class="filter"
						type="search"
						placeholder="Filter by name, guest, email, code…"
						bind:value={filter}
					/>
					<button class="claret-btn small" type="button" onclick={addDraft}>+ New party</button>
				</div>
			</div>

			{#if drafts.length}
				<div class="drafts">
					<div class="drafts-bar">
						<span class="hint">
							{drafts.length === 1 ? 'One party in progress' : `${drafts.length} parties in progress`}
							— drafts live on this device until you save them, so a refresh loses nothing.
						</span>
						{#if drafts.length > 1}
							<button class="ghost-btn small" type="button" onclick={saveAllDrafts}>
								Save all ({drafts.length})
							</button>
						{/if}
					</div>
					{#each drafts as d (d.key)}
						<div class="draft-card">
							<PartyEditor
								bind:this={editors[d.key]}
								draft={d}
								{notify}
								onSaved={(name) => draftSaved(d.key, name)}
								onDiscard={() => {
									removeDraft(d.key);
									notify('Draft discarded.');
								}}
							/>
						</div>
					{/each}
				</div>
			{/if}

			{#each visibleParties as party (party.id)}
				<details class="party">
					<summary>
						<span class="p-name">{party.display_name}</span>
						<span class="p-meta">
							<code>{party.code}</code>
							· {party.guests.length}
							{party.guests.length === 1 ? 'guest' : 'guests'}
							{#if dirtyEdits[party.id]}<span class="chip warn">unsaved edits</span>{/if}
							{#if !party.invited_at}<span class="chip wait">not invited</span>{/if}
							{#if party.responded_at}
								<span class="chip ok">responded</span>
							{:else}
								<span class="chip wait">pending</span>
							{/if}
						</span>
					</summary>
					<div class="p-body">
						<p class="hint linkline">
							Invite link <code>/rsvp?code={party.code}</code>
							<button class="mini-btn" type="button" onclick={() => copyLink(party.code)}>
								Copy
							</button>
							{#if party.invited_at}· invited {fmtDate(party.invited_at)}{/if}
							{#if party.reminded_at}· reminded {fmtDate(party.reminded_at)}{/if}
						</p>
						{#if party.song_requests}<p class="hint">Songs: {party.song_requests}</p>{/if}
						{#if party.message}<p class="hint">Note: “{party.message}”</p>{/if}
						<PartyEditor {party} {notify} onDirty={(v) => (dirtyEdits[party.id] = v)} />
					</div>
				</details>
			{:else}
				{#if !drafts.length}
					<p class="hint">No parties yet — start with “+ New party”.</p>
				{/if}
			{/each}
			{#if data.parties.length && !visibleParties.length}
				<p class="hint">No party matches “{filter}”.</p>
			{/if}
		</section>

		<section class="panel">
			<h2>Invitations</h2>
			<p class="hint">
				Sends the invitation email to each party's contact (plus any per-guest contacts). Defaults
				to parties <b>not yet invited</b>, so re-running won't double-send.
				{#if data.smsConfigured}Texts go to parties with a phone number.{:else}
					<i>SMS is off until Twilio is configured.</i>{/if}
			</p>
			<form method="POST" action="?/invite" use:enhance={handleInvite} class="send-form">
				<label class="inline">
					Who
					<select name="audience" bind:value={inviteAudience}>
						<option value="uninvited">Parties not yet invited ({uninvitedCount})</option>
						<option value="all">Everyone — re-send ({data.parties.length})</option>
					</select>
				</label>
				{#if data.smsConfigured}
					<label class="check"><input type="checkbox" name="sms" checked /> also send texts</label>
				{/if}
				<ConfirmButton
					label="Send invitations"
					confirmLabel="Yes, send"
					message={`This emails ${inviteAudience === 'all' ? data.parties.length : uninvitedCount} ${
						(inviteAudience === 'all' ? data.parties.length : uninvitedCount) === 1
							? 'party'
							: 'parties'
					}.`}
					busy={inviteBusy}
					busyLabel="Sending…"
					disabled={inviteAudience === 'uninvited' && uninvitedCount === 0}
				/>
			</form>
			{#if inviteResult}
				<p class="ok">
					Invited {inviteResult.parties} parties — {inviteResult.emails} emails,
					{inviteResult.texts} texts.
				</p>
				{#if inviteResult.failed}
					<p class="err">
						{inviteResult.failed} email(s) failed. First error: {inviteResult.error}
					</p>
				{/if}
				{#if inviteResult.parties === 0}
					<p class="hint">
						<i>No parties matched — either everyone's already invited, or no parties have a contact
							email. Add emails, or choose "Everyone (re-send)".</i>
					</p>
				{/if}
			{/if}
			{#if inviteError}<p class="err" role="alert">{inviteError}</p>{/if}
		</section>

		<section class="panel">
			<h2>Reminders</h2>
			<p class="hint">
				Emails every party that hasn't responded (needs a contact email on the party).
				{#if data.smsConfigured}Texts go to parties with a phone number.{:else}
					<i>SMS is not configured — add the Twilio keys to .env to enable texts.</i>{/if}
			</p>
			<form method="POST" action="?/remind" use:enhance={handleRemind} class="send-form">
				{#if data.smsConfigured}
					<label class="check"><input type="checkbox" name="sms" checked /> also send texts</label>
				{/if}
				<ConfirmButton
					label="Send reminders now"
					confirmLabel="Yes, send"
					message={`This nudges up to ${pendingCount} ${pendingCount === 1 ? 'party' : 'parties'} that haven't responded.`}
					busy={remindBusy}
					busyLabel="Sending…"
					disabled={pendingCount === 0}
				/>
			</form>
			{#if remindResult}
				<p class="ok">
					Nudged {remindResult.parties} parties — {remindResult.emails} emails,
					{remindResult.texts} texts.
					{#if remindResult.skipped}
						({remindResult.skipped} skipped — reminded in the last 48h.){/if}
				</p>
			{/if}
			{#if remindError}<p class="err" role="alert">{remindError}</p>{/if}
		</section>

		<section class="panel">
			<h2>Send an update</h2>
			<p class="hint">
				Emails (and texts) a message to a group of parties — venue changes, booking news, schedule.
				Goes to each party's contact plus any per-guest contacts.
				{#if !data.smsConfigured}<i>SMS is off until Twilio is configured.</i>{/if}
			</p>
			<form method="POST" action="?/broadcast" use:enhance={handleBroadcast} class="party-form">
				<label>
					Subject
					<input name="subject" bind:value={bcSubject} placeholder="A small change to our plans" />
				</label>
				<label>
					Message
					<textarea name="message" bind:value={bcMessage} rows="4" placeholder="Write your update here…"
					></textarea>
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
				<div>
					<ConfirmButton
						label="Send update"
						confirmLabel="Yes, send"
						message="This goes out immediately."
						busy={broadcastBusy}
						busyLabel="Sending…"
						disabled={!bcSubject.trim() || !bcMessage.trim()}
					/>
					{#if !bcSubject.trim() || !bcMessage.trim()}
						<span class="hint inline-hint">Needs a subject and a message.</span>
					{/if}
				</div>
			</form>
			{#if broadcastResult}
				<p class="ok">
					Sent to {broadcastResult.recipients} parties — {broadcastResult.emails} emails,
					{broadcastResult.texts} texts.
				</p>
			{/if}
			{#if broadcastError}<p class="err" role="alert">{broadcastError}</p>{/if}
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
							<ConfirmButton label="Delete" confirmLabel="Yes, delete" kind="danger" small />
						</form>
					</div>
				</div>
			{:else}
				<p class="hint">No notes yet.</p>
			{/each}
		</section>
	{/if}
</main>

{#if toasts.length}
	<div class="toasts" aria-live="polite">
		{#each toasts as t (t.id)}
			<button class="toast {t.kind}" type="button" onclick={() => dismissToast(t.id)}>
				{t.text}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* The admin is a working tool: headings and stat numbers keep the site's
	   display serif, but every label, field, and hint switches to a plain
	   sans so long entry sessions stay easy on the eyes. */
	.admin,
	.toasts {
		--body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial,
			sans-serif;
	}
	.admin {
		max-width: 960px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 5rem;
		display: grid;
		gap: 2rem;
		font-family: var(--body);
		font-size: 0.98rem;
		font-weight: 400;
		line-height: 1.55;
	}
	.admin :global(.claret-btn),
	.admin :global(.ghost-btn) {
		letter-spacing: 0.12em;
		text-indent: 0.12em;
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
		font-size: 0.68rem;
		letter-spacing: 0.1em;
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
	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.8rem;
	}
	.panel-head h2 {
		margin-bottom: 0;
	}
	.head-tools {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.filter {
		background: rgba(0, 0, 0, 0.18);
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.45rem 0.7rem;
		font-family: var(--body);
		font-size: 0.95rem;
		width: min(280px, 100%);
	}
	.filter:focus {
		outline: none;
		border-color: var(--candle);
	}
	.hint {
		color: var(--ink-faint);
		font-size: 0.88rem;
		margin: 0.3rem 0;
	}
	.inline-hint {
		margin-left: 0.8rem;
	}
	.ok {
		color: #9db07f;
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
	}
	.inline select,
	.party-form select {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.4rem 0.6rem;
		font-family: var(--body);
		font-size: 0.95rem;
	}
	.send-form {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	/* drafts */
	.drafts {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.4rem;
	}
	.drafts-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.draft-card {
		border: 1px dashed rgba(227, 184, 127, 0.45);
		padding: 1rem;
		background: rgba(227, 184, 127, 0.04);
	}

	/* party list */
	.party {
		border-top: 1px solid var(--line);
		padding: 0.6rem 0;
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
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.p-meta code,
	.hint code {
		color: var(--candle);
		font-size: 0.85em;
	}
	.chip {
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.12rem 0.5rem;
		border: 1px solid;
		white-space: nowrap;
	}
	.chip.ok {
		color: #9db07f;
		border-color: rgba(157, 176, 127, 0.4);
	}
	.chip.wait {
		color: var(--candle);
		border-color: rgba(227, 184, 127, 0.35);
	}
	.chip.warn {
		color: var(--candle);
		border-color: var(--candle);
	}
	.p-body {
		padding: 0.6rem 0 1rem;
		display: grid;
		gap: 0.9rem;
	}
	.linkline {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.mini-btn {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: var(--body);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.3rem 0.75rem;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}
	.mini-btn:hover {
		border-color: var(--candle);
	}

	/* broadcast form */
	.party-form {
		display: grid;
		gap: 0.7rem;
	}
	.party-form label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.82rem;
		color: var(--ink-muted);
	}
	.party-form input,
	.party-form textarea {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--ink-on-dark);
		padding: 0.5rem 0.7rem;
		font-family: var(--body);
		font-size: 1rem;
	}
	.party-form input:focus,
	.party-form textarea:focus {
		outline: none;
		border-color: var(--candle);
	}

	/* guestbook */
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
		align-items: center;
	}
	.note-actions button[type='submit']:not(:global(.btn)) {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-family: var(--body);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
	}

	/* toasts */
	.toasts {
		position: fixed;
		bottom: 1.2rem;
		right: 1.2rem;
		display: grid;
		gap: 0.5rem;
		z-index: 60;
		max-width: min(360px, calc(100vw - 2.4rem));
	}
	.toast {
		text-align: left;
		background: var(--espresso);
		color: var(--ink-on-dark);
		border: 1px solid rgba(157, 176, 127, 0.5);
		padding: 0.7rem 1rem;
		font-family: var(--body);
		font-size: 0.95rem;
		cursor: pointer;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
		animation: toast-in 0.25s ease;
	}
	.toast.err {
		border-color: rgba(201, 159, 148, 0.6);
		color: var(--blush);
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
