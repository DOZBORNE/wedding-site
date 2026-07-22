<script lang="ts">
	import Hero from '$lib/components/Hero.svelte';
	import Story from '$lib/components/Story.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	// import WeddingParty from '$lib/components/WeddingParty.svelte'; // temporarily disabled
	import Setting from '$lib/components/Setting.svelte';
	import Day from '$lib/components/Day.svelte';
	import Travel from '$lib/components/Travel.svelte';
	import RsvpSection from '$lib/components/RsvpSection.svelte';
	import Guestbook from '$lib/components/Guestbook.svelte';
	import Faq from '$lib/components/Faq.svelte';
	import Registry from '$lib/components/Registry.svelte';

	let { data } = $props();
</script>

<Hero />
<Story />
<Gallery />
<!-- <WeddingParty /> temporarily disabled -->
<Setting />
<Day />
<Travel />
<RsvpSection />
<Guestbook entries={data.guestbook} />
<Faq />
<Registry />
