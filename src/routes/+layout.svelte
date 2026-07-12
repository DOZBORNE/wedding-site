<script lang="ts">
	import '@fontsource/bodoni-moda/400.css';
	import '@fontsource/bodoni-moda/400-italic.css';
	import '@fontsource/bodoni-moda/500.css';
	import '@fontsource/cormorant-garamond/400.css';
	import '@fontsource/cormorant-garamond/400-italic.css';
	import '@fontsource/cormorant-garamond/500.css';
	import '@fontsource/cormorant-garamond/600.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { COUPLE, VENUE, WEDDING } from '$lib/config';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	const title = `${COUPLE.first} & ${COUPLE.partnerFirst} — ${WEDDING.dateLabel}`;
	const description = `${COUPLE.first} ${COUPLE.last} & ${COUPLE.partnerFirst} ${COUPLE.partnerLast} are getting married ${WEDDING.dateLabel} at ${VENUE.name}, ${VENUE.shortAddress}. Details & RSVP.`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta name="theme-color" content="#221A14" />
</svelte:head>

<div class="grain" aria-hidden="true"></div>
<Nav />
{@render children()}
<Footer />
