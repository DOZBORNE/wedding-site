<script lang="ts">
	import { REGISTRY_URL } from '$lib/config';
	import { reveal } from '$lib/reveal';
	import Icon from './Icon.svelte';
	import SectionHead from './SectionHead.svelte';
</script>

<section class="block registry" id="registry">
	<div class="wrap" use:reveal>
		<SectionHead
			eyebrow="Registry"
			title="Your presence is the present"
			vine={false}
		/>
		<p class="lede center">
			But should you wish to give more, our registry lives with The Knot.
		</p>
		<div class="cta">
			<a class="ghost-btn" href={REGISTRY_URL} target="_blank" rel="noopener">
				View our registry <Icon name="out" />
			</a>
		</div>
	</div>
</section>

<style>
	.registry {
		text-align: center;
	}
	.center {
		margin-bottom: 2rem;
	}
	.cta {
		display: flex;
		justify-content: center;
	}
</style>
