<script lang="ts">
	import { VENUE } from '$lib/config';
	import { onMount } from 'svelte';

	let container = $state<HTMLDivElement>();
	let failed = $state(false);

	/** Repaint the basemap into the wedding palette. */
	function retheme(map: import('maplibre-gl').Map) {
		const layers = map.getStyle()?.layers ?? [];
		for (const layer of layers) {
			const id = layer.id;
			const set = (prop: string, val: unknown) => {
				try {
					map.setPaintProperty(id, prop, val as never);
				} catch {
					/* not every layer has every prop */
				}
			};
			if (layer.type === 'background') {
				set('background-color', '#221A14');
			} else if (layer.type === 'fill') {
				if (/water|ocean|lake/i.test(id)) set('fill-color', '#2C3833');
				else if (/park|grass|wood|forest|landcover|vegetation|cemetery|golf|scrub/i.test(id))
					set('fill-color', '#2A3324');
				else if (/building/i.test(id)) set('fill-color', '#2B241D');
				else set('fill-color', '#261F19');
				set('fill-outline-color', 'rgba(232,220,200,0.06)');
			} else if (layer.type === 'line') {
				if (/water|river|stream|canal/i.test(id)) set('line-color', '#2C3833');
				else if (/motorway|trunk|primary/i.test(id)) set('line-color', 'rgba(227,184,127,0.3)');
				else if (/road|street|minor|secondary|tertiary|service|path|rail|bridge|tunnel|highway|link/i.test(id))
					set('line-color', 'rgba(232,220,200,0.16)');
				else set('line-color', 'rgba(232,220,200,0.08)');
			} else if (layer.type === 'symbol') {
				set('text-color', '#C9BBA0');
				set('text-halo-color', '#221A14');
				set('icon-opacity', 0.35);
			}
		}
	}

	onMount(() => {
		let map: import('maplibre-gl').Map | undefined;
		let io: IntersectionObserver | undefined;

		// ~250KB of map runtime — only fetched once the reader nears the map
		const init = async () => {
			try {
				if (!container || map) return;
				const [{ default: maplibre }] = await Promise.all([
					import('maplibre-gl'),
					import('maplibre-gl/dist/maplibre-gl.css')
				]);
				map = new maplibre.Map({
					container,
					style: 'https://tiles.openfreemap.org/styles/liberty',
					center: [VENUE.lng, VENUE.lat],
					zoom: 13.6,
					cooperativeGestures: true,
					attributionControl: { compact: true }
				});
				map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
				map.on('style.load', () => retheme(map!));

				const el = document.createElement('div');
				el.className = 'map-seal';
				el.textContent = 'DJ';
				const popup = new maplibre.Popup({ offset: 30 }).setHTML(
					`<strong style="font-family:var(--display);font-size:1.05rem;">${VENUE.name}</strong><br/>` +
						`<span style="font-style:italic;">${VENUE.address}</span><br/>` +
						`<a href="${VENUE.directionsUrl}" target="_blank" rel="noopener" style="color:var(--claret);letter-spacing:0.14em;text-transform:uppercase;font-size:0.72rem;">Get directions ↗</a>`
				);
				new maplibre.Marker({ element: el, anchor: 'center' })
					.setLngLat([VENUE.lng, VENUE.lat])
					.setPopup(popup)
					.addTo(map);
				map.on('error', () => {});
			} catch {
				failed = true;
			}
		};

		try {
			io = new IntersectionObserver(
				(entries) => {
					if (entries.some((e) => e.isIntersecting)) {
						io?.disconnect();
						init();
					}
				},
				{ rootMargin: '600px' }
			);
			if (container) io.observe(container);
		} catch {
			init();
		}
		return () => {
			io?.disconnect();
			map?.remove();
		};
	});
</script>

<div class="map-frame">
	{#if failed}
		<div class="map-fallback">
			<p><strong>{VENUE.name}</strong></p>
			<p><i>{VENUE.address}</i></p>
			<a class="ghost-btn" href={VENUE.directionsUrl} target="_blank" rel="noopener">
				Get directions ↗
			</a>
		</div>
	{:else}
		<div class="map" bind:this={container}></div>
	{/if}
</div>

<style>
	.map-frame {
		border: 1px solid rgba(230, 217, 198, 0.25);
		outline: 1px solid rgba(230, 217, 198, 0.08);
		outline-offset: 6px;
		box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.map,
	.map-fallback {
		height: clamp(320px, 50vw, 460px);
		width: 100%;
	}
	.map-fallback {
		display: grid;
		place-content: center;
		gap: 0.8rem;
		text-align: center;
		background: #261f19;
	}
	:global(.map-seal) {
		width: 40px;
		height: 40px;
		border-radius: 47% 53% 50% 50% / 52% 48% 52% 48%;
		background: radial-gradient(circle at 34% 30%, #7a2a33, var(--claret) 65%, #240a0e);
		box-shadow:
			0 6px 16px rgba(0, 0, 0, 0.55),
			inset 0 2px 4px rgba(255, 255, 255, 0.18),
			inset 0 -3px 7px rgba(0, 0, 0, 0.45);
		display: grid;
		place-items: center;
		font-family: var(--display);
		font-style: italic;
		font-size: 0.85rem;
		color: rgba(232, 220, 200, 0.9);
		cursor: pointer;
	}
</style>
