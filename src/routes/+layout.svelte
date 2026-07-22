<script lang="ts">
	import '@fontsource/bodoni-moda/400.css';
	import '@fontsource/bodoni-moda/400-italic.css';
	import '@fontsource/bodoni-moda/500.css';
	import '@fontsource/cormorant-garamond/400.css';
	import '@fontsource/cormorant-garamond/400-italic.css';
	import '@fontsource/cormorant-garamond/500.css';
	import '@fontsource/cormorant-garamond/600.css';
	import '@fontsource/cormorant-garamond/600-italic.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import displayFont from '@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2?url';
	import bodyFont from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url';
	import { page } from '$app/state';
	import { COUPLE, VENUE, WEDDING } from '$lib/config';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
	const title = `${COUPLE.first} & ${COUPLE.partnerFirst} — ${WEDDING.dateLabel}`;
	const description = `${COUPLE.first} ${COUPLE.last} & ${COUPLE.partnerFirst} ${COUPLE.partnerLast} are getting married ${WEDDING.dateLabel} at ${VENUE.name}, ${VENUE.shortAddress}. Details & RSVP.`;
	const ogAlt = `A claret and cream wedding invitation: a Roman arch between two ivy-wrapped columns holding the monogram D&J — ${title}, ${VENUE.name}`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" as="font" type="font/woff2" href={displayFont} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={bodyFont} crossorigin="anonymous" />
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:site_name" content="{COUPLE.first} & {COUPLE.partnerFirst}" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={page.url.origin + page.url.pathname} />
	<meta property="og:image" content="{page.url.origin}/og.png?v=2" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={ogAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="{page.url.origin}/og.png?v=2" />
	<meta name="theme-color" content="#221A14" />
</svelte:head>

<div class="grain" aria-hidden="true"></div>
<div class="scroll-root">
	<Nav />
	{@render children()}
	<Footer />
</div>
