<script lang="ts">
	/**
	 * A phone field that formats itself as you type — "2177791753" becomes
	 * "(217) 779-1753" — while the bound value stays canonical +E.164 for Twilio.
	 * Numbers outside the default country are typed with their own code ("+44 20…").
	 */
	import { tick } from 'svelte';
	import { DEFAULT_COUNTRY, formatAsTyped, formatPhone, toE164 } from '$lib/phone';
	import type { CountryCode } from 'libphonenumber-js';

	let {
		value = $bindable(''),
		country = DEFAULT_COUNTRY,
		name = '',
		placeholder = '',
		ariaLabel = '',
		invalid = false,
		onblur,
		onkeydown
	}: {
		/** Canonical value — +E.164 once the number is valid, otherwise what was typed. */
		value?: string;
		country?: CountryCode;
		/** Set to post the canonical value with the surrounding form. */
		name?: string;
		placeholder?: string;
		ariaLabel?: string;
		invalid?: boolean;
		onblur?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
	} = $props();

	let el = $state<HTMLInputElement>();
	// svelte-ignore state_referenced_locally
	let display = $state(formatPhone(value, country));
	// svelte-ignore state_referenced_locally
	let lastPushed = value;

	// Re-seed when the value changes from outside (a save re-seed, a restored guest).
	$effect(() => {
		if (value !== lastPushed) {
			lastPushed = value;
			display = formatPhone(value, country);
		}
	});

	const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

	/** Where the caret belongs after reformatting: just past the nth digit. */
	function caretAfterDigits(s: string, n: number) {
		if (n <= 0) return s.startsWith('+') ? Math.min(1, s.length) : 0;
		let seen = 0;
		for (let i = 0; i < s.length; i++) {
			if (/\d/.test(s[i]) && ++seen === n) return i + 1;
		}
		return s.length;
	}

	async function handleInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const deleting = (e as InputEvent).inputType?.startsWith('delete') ?? false;
		const before = digitCount(input.value.slice(0, input.selectionStart ?? input.value.length));

		// Backspacing over "(217) " should eat the digit, not the punctuation the
		// formatter would immediately put back.
		const raw = deleting ? input.value.replace(/\D+$/, '') : input.value;
		const formatted = formatAsTyped(raw, country);
		display = formatted;
		const next = /\d/.test(formatted) ? toE164(formatted, country) || formatted.trim() : '';
		lastPushed = next;
		value = next;

		await tick();
		if (el && el.value === formatted) {
			const pos = caretAfterDigits(formatted, before);
			el.setSelectionRange(pos, pos);
		}
	}

	function handleBlur() {
		display = formatPhone(value || display, country);
		onblur?.();
	}
</script>

<input
	bind:this={el}
	type="tel"
	inputmode="tel"
	autocomplete="tel"
	aria-label={ariaLabel || undefined}
	{placeholder}
	value={display}
	class:bad={invalid}
	oninput={handleInput}
	onblur={handleBlur}
	{onkeydown}
/>
{#if name}<input type="hidden" {name} {value} />{/if}

<style>
	/* Matches the fields in PartyEditor — style lives here because scoped styles
	   don't cross the component boundary. */
	input[type='tel'] {
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
	input[type='tel']:focus {
		outline: none;
		border-color: var(--candle);
	}
	input[type='tel'].bad {
		border-color: rgba(201, 159, 148, 0.75);
	}
	input[type='tel']::placeholder {
		color: var(--ink-faint);
		opacity: 0.6;
	}
</style>
