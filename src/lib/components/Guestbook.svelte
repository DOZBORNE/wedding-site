<script lang="ts">
	import type { GuestbookEntry } from '$lib/types';
	import { reveal } from '$lib/reveal';
	import SectionHead from './SectionHead.svelte';

	let { entries = [] }: { entries?: GuestbookEntry[] } = $props();

	// starters — the blank box is the hard part of every guestbook
	const PROMPTS = [
		{ label: 'Marriage advice', starter: 'Our best marriage advice: ' },
		{ label: 'A memory of us', starter: 'A favorite memory with you two: ' },
		{ label: 'For the dance floor', starter: 'Play this at the reception: ' },
		{ label: 'A toast', starter: 'Here’s to you both — ' }
	];

	let name = $state('');
	let message = $state('');
	let website = $state(''); // honeypot
	let sending = $state(false);
	let sent = $state(false);
	let errorMsg = $state('');
	let noteEl = $state<HTMLTextAreaElement>();

	function usePrompt(starter: string) {
		if (!message.trim() || PROMPTS.some((p) => message === p.starter)) message = starter;
		else message = `${starter}${message}`;
		noteEl?.focus();
	}

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
			lede="A line, a memory, a song, a toast — we'll keep every one."
		/>

		<div class="gb-form parchment-card" use:reveal>
			{#if sent}
				<p class="thanks"><i>Thank you — we'll read it together after the wedding. ❦</i></p>
			{:else}
				<form onsubmit={submit}>
					<div class="chips" role="group" aria-label="Note ideas">
						{#each PROMPTS as prompt (prompt.label)}
							<button type="button" class="chip" onclick={() => usePrompt(prompt.starter)}>
								{prompt.label}
							</button>
						{/each}
					</div>
					<div class="field">
						<label for="gb-message">Your note</label>
						<textarea
							id="gb-message"
							rows="3"
							bind:value={message}
							bind:this={noteEl}
							required
							maxlength="1000"
							placeholder="pick a prompt above, or free-hand it"
						></textarea>
					</div>
					<div class="row">
						<div class="field grow">
							<label for="gb-name">Signed</label>
							<input id="gb-name" type="text" bind:value={name} required maxlength="80" placeholder="your name" />
						</div>
						<button class="claret-btn" type="submit" disabled={sending}>
							{sending ? 'Sending…' : 'Sign the book'}
						</button>
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
				</form>
			{/if}
		</div>

		{#if entries.length}
			<div class="wall" use:reveal>
				{#each entries as entry, i (entry.id)}
					<blockquote class="note" style="--tilt:{[-1.6, 1.2, -0.8, 1.8, -1.2, 0.9][i % 6]}deg">
						<span class="pin" aria-hidden="true"></span>
						<p>{entry.message}</p>
						<footer>— {entry.name}</footer>
					</blockquote>
				{/each}
			</div>
		{:else}
			<p class="empty" use:reveal><i>The first page is blank — sign it?</i></p>
		{/if}
	</div>
</section>

<style>
	.guestbook {
		background: linear-gradient(180deg, var(--espresso), #291b15 55%, var(--espresso));
	}
	.gb-form {
		max-width: 560px;
		margin: 0 auto clamp(2.5rem, 6vw, 4rem);
		padding: 2.2rem 2rem;
	}
	.gb-form form {
		display: grid;
		gap: 1.1rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.chip {
		border: 1px solid rgba(58, 36, 32, 0.45);
		background: transparent;
		font-family: var(--body);
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--chocolate);
		padding: 0.42rem 0.95rem;
		border-radius: 999px;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}
	.chip:hover {
		background: var(--claret);
		border-color: var(--claret);
		color: var(--parchment);
	}
	.row {
		display: flex;
		align-items: end;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.grow {
		flex: 1;
		min-width: 180px;
	}
	@media (max-width: 560px) {
		.row {
			flex-direction: column;
			align-items: stretch;
		}
		.row .claret-btn {
			width: 100%;
		}
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
		font-size: 1.2rem;
	}
	.error {
		margin: 0;
		color: #7a1f28;
		font-style: italic;
	}

	/* the note wall */
	.wall {
		columns: 3 240px;
		column-gap: 1.4rem;
	}
	.note {
		break-inside: avoid;
		margin: 0 0 1.4rem;
		position: relative;
		background:
			radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255, 255, 255, 0.3), transparent 60%),
			linear-gradient(165deg, var(--parchment) 0%, var(--parchment-deep) 100%);
		color: var(--ink-on-paper);
		padding: 1.6rem 1.3rem 1.1rem;
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
		transform: rotate(var(--tilt, 0deg));
		transition: transform 0.35s ease;
	}
	.note:hover {
		transform: rotate(0deg) scale(1.02);
	}
	.pin {
		position: absolute;
		top: -9px;
		left: 50%;
		transform: translateX(-50%);
		width: 18px;
		height: 18px;
		border-radius: 47% 53% 50% 50% / 52% 48% 52% 48%;
		background: radial-gradient(circle at 34% 30%, #7a2a33, var(--claret) 65%, #240a0e);
		box-shadow: 0 3px 7px rgba(0, 0, 0, 0.4);
	}
	.note p {
		margin: 0 0 0.5rem;
		font-style: italic;
		font-size: 1.02rem;
		line-height: 1.55;
	}
	.note footer {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--chocolate);
	}
	.empty {
		text-align: center;
		color: var(--ink-faint);
	}
</style>
