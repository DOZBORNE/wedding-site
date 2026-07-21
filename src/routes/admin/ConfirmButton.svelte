<script lang="ts">
	/**
	 * Two-step confirm, inline — replaces window.confirm(). First click arms the
	 * button into a "message + confirm + never mind" strip; it disarms itself
	 * after a few seconds. Without `onConfirm` the confirm button is a submit
	 * button for the surrounding form (so it plays nicely with use:enhance).
	 */
	let {
		label,
		confirmLabel = 'Confirm',
		message = '',
		kind = 'primary',
		small = false,
		disabled = false,
		busy = false,
		busyLabel = 'Working…',
		onConfirm
	}: {
		label: string;
		confirmLabel?: string;
		message?: string;
		kind?: 'primary' | 'danger' | 'quiet';
		small?: boolean;
		disabled?: boolean;
		busy?: boolean;
		busyLabel?: string;
		onConfirm?: () => void;
	} = $props();

	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function arm() {
		armed = true;
		clearTimeout(timer);
		timer = setTimeout(() => (armed = false), 8000);
	}
	function disarm() {
		clearTimeout(timer);
		armed = false;
	}
	$effect(() => {
		if (busy) disarm();
	});
	$effect(() => () => clearTimeout(timer));
</script>

{#if armed && !busy}
	<span class="strip">
		{#if message}<span class="msg" class:small>{message}</span>{/if}
		<button
			type={onConfirm ? 'button' : 'submit'}
			class="btn go {kind}"
			class:small
			onclick={() => {
				if (onConfirm) {
					disarm();
					onConfirm();
				}
			}}
		>
			{confirmLabel}
		</button>
		<button type="button" class="btn quiet" class:small onclick={disarm}>Never mind</button>
	</span>
{:else}
	<button type="button" class="btn {kind}" class:small disabled={disabled || busy} onclick={arm}>
		{busy ? busyLabel : label}
	</button>
{/if}

<style>
	.strip {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.msg {
		color: var(--candle);
		font-size: 0.88rem;
	}
	.msg.small {
		font-size: 0.84rem;
	}
	.btn {
		font-family: var(--body);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		text-indent: 0.12em;
		text-transform: uppercase;
		padding: 0.65rem 1.3rem;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}
	.btn.small {
		padding: 0.4rem 0.9rem;
		font-size: 0.66rem;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.primary {
		background: var(--claret);
		border: 1px solid var(--claret);
		color: var(--parchment);
	}
	.primary:hover:not(:disabled) {
		background: var(--burgundy);
	}
	.danger {
		background: none;
		border: 1px solid rgba(201, 159, 148, 0.4);
		color: var(--blush);
	}
	.danger:hover:not(:disabled) {
		border-color: var(--blush);
	}
	.quiet {
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
	}
	.quiet:hover:not(:disabled) {
		border-color: var(--candle);
	}
	.go.danger {
		background: rgba(201, 159, 148, 0.12);
	}
</style>
