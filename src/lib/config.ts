/**
 * Single source of truth for site content.
 * Anything marked TODO is placeholder copy for Devin & Jessica to personalize.
 */

export const COUPLE = {
	first: 'Devin',
	last: 'Osborne',
	partnerFirst: 'Jessica',
	partnerLast: 'Connally',
	monogram: ['D', 'J'] as const,
	hashtag: '#TheOsbornes2026'
};

export const WEDDING = {
	/** Ceremony start, America/Chicago */
	dateISO: '2026-11-06T16:00:00-06:00',
	dateLabel: 'November 6, 2026',
	dateShort: '11 · 06 · 2026',
	ceremonyTime: 'Four in the afternoon',
	receptionTime: 'Half past five',
	rsvpDeadlineLabel: 'October 2, 2026' // TODO: confirm RSVP deadline
};

export const VENUE = {
	name: 'Aldridge Gardens',
	address: '3530 Lorna Road, Hoover, Alabama 35216',
	shortAddress: 'Hoover, Alabama',
	url: 'https://aldridgegardens.com',
	lat: 33.38722,
	lng: -86.79212,
	directionsUrl:
		'https://www.google.com/maps/dir/?api=1&destination=Aldridge+Gardens,+3530+Lorna+Rd,+Hoover,+AL+35216'
};

export const REGISTRY_URL =
	'https://www.theknot.com/us/jessica-connally-and-devin-osborne-2026-11-06/registry';

export const MEALS = ['Beef', 'Chicken', 'Vegetarian']; // TODO: confirm menu with caterer

/** Story chapters. Each mirror flips through its plates (photos). */
export const CHAPTERS = [
	{
		numeral: 'Chapter I',
		title: 'The Meeting',
		// TODO: replace with the real story, in your own words
		body: 'Every story has a first page. This is ours — where we met, what we noticed first, and the detail we still tease each other about. (Devin: write the real thing here; the drop cap is waiting.)',
		plates: [
			{ src: '', caption: 'the early days', tone: 'blush' },
			{ src: '', caption: 'where it started', tone: 'olive' }
		]
	},
	{
		numeral: 'Chapter II',
		title: 'The Years Between',
		body: 'First trips, small rituals, the life we built in Birmingham. The middle chapters are the best ones — and most of the engagement photos live here, framed like plates in an old book.',
		plates: [
			{ src: '', caption: 'the years between', tone: 'olive' },
			{ src: '', caption: 'somewhere on the road', tone: 'candle' },
			{ src: '', caption: 'home', tone: 'mauve' }
		]
	},
	{
		numeral: 'Chapter III',
		title: 'The Question',
		body: 'The plan, the nerves, the yes. And now: a garden, a lake, a pavilion, and everyone we love in one place. The next chapter is dated November 6, 2026.',
		plates: [
			{ src: '', caption: 'the proposal', tone: 'candle' },
			{ src: '', caption: 'she said yes', tone: 'blush' }
		]
	}
];

export const TIMELINE = [
	{ label: 'First met', value: '20XX' }, // TODO
	{ label: 'She said yes', value: '2025' }, // TODO: confirm year
	{ label: 'The wedding', value: '2026' }
];

/** Gallery — engagement photos. Add files to /static/photos and set src: '/photos/01.jpg' */
export const GALLERY = [
	{ src: '', caption: 'the proposal', tone: 'blush', tall: true },
	{ src: '', caption: 'golden hour', tone: 'olive', tall: false },
	{ src: '', caption: 'the ring', tone: 'candle', tall: true },
	{ src: '', caption: 'downtown', tone: 'mauve', tall: false },
	{ src: '', caption: 'the garden', tone: 'blush', tall: true },
	{ src: '', caption: 'us', tone: 'olive', tall: false }
];

/** Hero photo — your best engagement shot, shown in claret duotone. */
export const HERO_PHOTO = ''; // e.g. '/photos/hero.jpg'

export const WEDDING_PARTY = {
	// TODO: fill in the real wedding party (and add portrait photos to /static/photos)
	bridesmaids: [
		{ name: 'Bridesmaid Name', role: 'Maid of Honor', src: '', tone: 'mauve' },
		{ name: 'Bridesmaid Name', role: 'Bridesmaid', src: '', tone: 'blush' },
		{ name: 'Bridesmaid Name', role: 'Bridesmaid', src: '', tone: 'olive' }
	],
	groomsmen: [
		{ name: 'Groomsman Name', role: 'Best Man', src: '', tone: 'olive' },
		{ name: 'Groomsman Name', role: 'Groomsman', src: '', tone: 'candle' },
		{ name: 'Groomsman Name', role: 'Groomsman', src: '', tone: 'mauve' }
	]
};

export const TRAVEL = [
	{
		title: 'Getting there',
		body: `Aldridge Gardens sits just off I-459 and I-65 in Hoover, about 20 minutes south of downtown Birmingham. Parking at the gardens is free.`
	},
	{
		title: 'Flying in',
		body: `Birmingham–Shuttlesworth International (BHM) is the closest airport, roughly 25 minutes from the venue. Rental cars and rideshares are both easy.`
	},
	{
		title: 'Where to stay',
		// TODO: confirm hotel blocks and add booking links
		body: `We're arranging room blocks at hotels near the Riverchase Galleria, five minutes from the gardens — details to follow here soon.`
	}
];

export const FAQ = [
	{
		q: 'What should I wear?',
		a: 'Evening attire in autumnal tones — think the palette of this site: olive, burgundy, mauve, cream. The ceremony and reception are outdoors in a garden, so choose shoes that can handle grass and gravel paths.'
	},
	{
		q: 'Will the wedding be indoors or outdoors?',
		a: 'Outdoors, start to finish: vows at the water’s edge, then dinner and dancing under the pavilion. Alabama in early November is usually lovely — highs around 65°F, cool after sunset — so bring a layer.'
	},
	{
		q: 'Can I bring a plus one?',
		a: 'Invitations are addressed to everyone included — when you RSVP, your party and any plus-one seats we could offer will appear automatically. We wish we could host everyone’s favorite people, but the pavilion only holds so many.'
	},
	{
		q: 'Are kids invited?',
		a: 'We love your little ones, but this will be an adults-only evening unless your invitation says otherwise.' // TODO: confirm
	},
	{
		q: 'Where do I park?',
		a: 'Aldridge Gardens has free on-site parking at 3530 Lorna Road. Follow the signs from the entrance; the ceremony is a short walk along the garden path.'
	},
	{
		q: 'When should I RSVP by?',
		a: `Please reply by ${WEDDING.rsvpDeadlineLabel} so we can give the caterer a final count. The RSVP button at the top of this page takes you straight there.`
	}
];

export const NAV_LINKS = [
	{ href: '/#story', label: 'Our Story' },
	{ href: '/#gallery', label: 'Gallery' },
	{ href: '/#day', label: 'The Day' },
	{ href: '/#travel', label: 'Travel' },
	{ href: '/#faq', label: 'FAQ' },
	{ href: '/#registry', label: 'Registry' }
];

/** Painted-plate placeholder gradients, used until real photos are added. */
export const TONES: Record<string, string> = {
	blush:
		'radial-gradient(ellipse 80% 50% at 50% 15%, rgba(201,159,148,0.38), transparent 60%), radial-gradient(ellipse 60% 60% at 15% 85%, rgba(75,90,58,0.5), transparent 65%), linear-gradient(180deg, #55343A, #33191E)',
	olive:
		'radial-gradient(ellipse 70% 45% at 60% 20%, rgba(139,144,127,0.42), transparent 60%), radial-gradient(ellipse 60% 55% at 20% 85%, rgba(106,74,80,0.5), transparent 65%), linear-gradient(180deg, #44503A, #241A14)',
	candle:
		'radial-gradient(ellipse 80% 50% at 50% 12%, rgba(227,184,127,0.34), transparent 55%), radial-gradient(ellipse 60% 60% at 80% 85%, rgba(106,74,80,0.55), transparent 65%), linear-gradient(180deg, #4E2A30, #241014)',
	mauve:
		'radial-gradient(ellipse 70% 50% at 30% 20%, rgba(201,159,148,0.3), transparent 60%), radial-gradient(ellipse 60% 55% at 75% 80%, rgba(75,90,58,0.4), transparent 65%), linear-gradient(180deg, #503038, #2A1318)'
};
