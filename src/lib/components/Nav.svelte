<script lang="ts">
	import { COUPLE, NAV_LINKS } from '$lib/config';
	import Seal from './Seal.svelte';

	let open = $state(false);
</script>

<nav class="nav">
	<a class="nav-mono" href="/#top" aria-label="Back to top">
		{COUPLE.monogram[0]}<i>&amp;</i>{COUPLE.monogram[1]}
	</a>

	<div class="nav-links">
		{#each NAV_LINKS as link (link.href)}
			<a href={link.href}>{link.label}</a>
		{/each}
	</div>

	<div class="nav-right">
		<a class="nav-rsvp" href="/#rsvp" onclick={() => (open = false)}>
			<Seal size={26} />RSVP
		</a>
		<button
			class="menu-btn"
			aria-expanded={open}
			aria-label={open ? 'Close menu' : 'Open menu'}
			onclick={() => (open = !open)}
		>
			{open ? '✕' : '☰'}
		</button>
	</div>
</nav>

{#if open}
	<div class="mobile-menu">
		{#each NAV_LINKS as link (link.href)}
			<a href={link.href} onclick={() => (open = false)}>{link.label}</a>
		{/each}
	</div>
{/if}

<style>
	.nav {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem clamp(1rem, 4vw, 2rem);
		background: rgba(27, 20, 16, 0.84);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--line);
	}
	.nav-mono {
		font-family: var(--display);
		font-size: 1.25rem;
		color: var(--parchment);
		text-decoration: none;
	}
	.nav-mono i {
		font-style: italic;
		color: var(--blush);
		font-size: 0.7em;
		vertical-align: 0.25em;
	}
	.nav-links {
		display: flex;
		gap: 1.5rem;
	}
	.nav-links a {
		text-decoration: none;
		font-size: 0.72rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--ink-muted);
		transition: color 0.2s ease;
	}
	.nav-links a:hover {
		color: var(--parchment);
	}
	.nav-right {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.nav-rsvp {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		border: 1px solid rgba(232, 220, 200, 0.35);
		padding: 0.38rem 0.9rem 0.38rem 0.5rem;
		font-size: 0.72rem;
		letter-spacing: 0.28em;
		text-indent: 0.1em;
		text-transform: uppercase;
		color: var(--parchment);
		transition:
			border-color 0.25s ease,
			background 0.25s ease;
	}
	.nav-rsvp:hover {
		border-color: var(--candle);
		background: rgba(227, 184, 127, 0.08);
	}
	.menu-btn {
		display: none;
		background: none;
		border: 1px solid var(--line);
		color: var(--ink-muted);
		font-size: 1rem;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
	}
	.mobile-menu {
		position: sticky;
		top: 3.4rem;
		z-index: 29;
		display: none;
		background: rgba(27, 20, 16, 0.96);
		border-bottom: 1px solid var(--line);
		padding: 1rem clamp(1rem, 4vw, 2rem) 1.4rem;
	}
	.mobile-menu a {
		display: block;
		text-decoration: none;
		font-size: 0.8rem;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding: 0.6rem 0;
		border-bottom: 1px solid rgba(230, 217, 198, 0.08);
	}
	@media (max-width: 860px) {
		.nav-links {
			display: none;
		}
		.menu-btn {
			display: block;
		}
		.mobile-menu {
			display: block;
		}
	}
</style>
