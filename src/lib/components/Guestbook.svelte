<script lang="ts">
	import type { GuestbookEntry } from '$lib/types';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';

	let { entries = [] }: { entries?: GuestbookEntry[] } = $props();

	let name = $state('');
	let message = $state('');
	let website = $state(''); // honeypot
	let sending = $state(false);
	let sent = $state(false);
	let errorMsg = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		sending = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/guestbook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, message, website })
			});
			const data = await res.json();
			if (!res.ok) errorMsg = data.error ?? 'Could not save your note — please try again.';
			else sent = true;
		} catch {
			errorMsg = 'Could not save your note — please check your connection and try again.';
		} finally {
			sending = false;
		}
	}
</script>

<section class="block guestbook" id="guestbook">
	<div class="wrap">
		<SectionHead
			eyebrow="The guestbook"
			title="Leave us a note"
			seed={18}
			lede="A line, a memory, a piece of marriage advice — we'll keep every one."
		/>

		<div class="gb-grid" use:reveal>
			<div class="gb-form parchment-card">
				{#if sent}
					<p class="thanks"><i>Thank you — we'll read it together. ❦</i></p>
				{:else}
					<form onsubmit={submit}>
						<div class="field">
							<label for="gb-name">Your name</label>
							<input id="gb-name" type="text" bind:value={name} required maxlength="80" />
						</div>
						<div class="field">
							<label for="gb-message">Your note</label>
							<textarea id="gb-message" rows="4" bind:value={message} required maxlength="1000"
							></textarea>
						</div>
						<input
							type="text"
							bind:value={website}
							name="website"
							tabindex="-1"
							autocomplete="off"
							aria-hidden="true"
							class="hp"
						/>
						{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
						<button class="claret-btn" type="submit" disabled={sending}>
							{sending ? 'Sending…' : 'Sign the book'}
						</button>
					</form>
				{/if}
			</div>

			<div class="notes">
				{#each entries as entry (entry.id)}
					<blockquote class="note">
						<p>{entry.message}</p>
						<footer>— {entry.name}</footer>
					</blockquote>
				{:else}
					<p class="empty"><i>The first page is blank — sign it?</i></p>
				{/each}
			</div>
		</div>
	</div>
</section>

<style>
	.guestbook {
		background: linear-gradient(180deg, var(--espresso), #291b15 55%, var(--espresso));
	}
	.gb-grid {
		display: grid;
		grid-template-columns: minmax(280px, 420px) 1fr;
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: start;
	}
	@media (max-width: 760px) {
		.gb-grid {
			grid-template-columns: 1fr;
		}
	}
	.gb-form {
		padding: 2rem 1.8rem;
	}
	.gb-form form {
		display: grid;
		gap: 1.1rem;
	}
	.hp {
		position: absolute;
		left: -9999px;
		height: 0;
		width: 0;
		opacity: 0;
	}
	.thanks {
		margin: 0;
		text-align: center;
		font-size: 1.15rem;
	}
	.error {
		margin: 0;
		color: #7a1f28;
		font-style: italic;
	}
	.notes {
		display: grid;
		gap: 1.2rem;
		align-content: start;
	}
	.note {
		margin: 0;
		border-left: 2px solid var(--mauve);
		padding: 0.7rem 0 0.7rem 1.2rem;
	}
	.note p {
		margin: 0 0 0.4rem;
		color: var(--ink-on-dark);
		font-style: italic;
		max-width: 55ch;
	}
	.note footer {
		font-size: 0.85rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.empty {
		color: var(--ink-faint);
	}
</style>
