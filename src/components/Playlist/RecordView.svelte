<script>
	import { onMount } from 'svelte';
	import { playlists } from '@stores/userDataStore.js';
	import { colors } from '@stores/layoutStore.js';

	$: displayItems = $playlists?.items?.length
		? Array.from({ length: 10 }, (_, i) => $playlists.items[i % $playlists.items.length])
		: [];

	let tilts = [];
	let activeIndex = 0;
	let recordEls = [];
	// Scroll sets targetTilts; the rAF loop gently lerps currentTilts toward them.
	let targetTilts = [];
	let currentTilts = [];

	// Active record gets highest z-index so it rises on top when coming into view.
	// Records below stack naturally (closest = highest among below).
	// Past records (scrolled away) drop to a low z-index.
	function getZIndex(index, active, total) {
		if (index === active) return 1000;
		if (index < active) return index + 1; // past: low, doesn't cover incoming
		return total - (index - active); // below: closer to active = higher
	}

	onMount(() => {
		// Initialize: first record flat, all others fully tilted
		targetTilts = displayItems.map((_, i) => (i === 0 ? 0 : 70));
		currentTilts = [...targetTilts];
		tilts = [...currentTilts];

		let rafId = null;

		// Only schedules a frame when there's still work to do — idles when settled.
		function scheduleAnimate() {
			if (rafId) return;
			rafId = requestAnimationFrame(animate);
		}

		function animate() {
			rafId = null;
			let needsUpdate = false;
			const next = currentTilts.map((curr, i) => {
				const target = targetTilts[i] ?? curr;
				const diff = target - curr;
				if (Math.abs(diff) < 0.05) return target; // snap when close enough
				needsUpdate = true;
				return curr + diff * 0.07; // lerp factor — lower = slower / gentler
			});
			currentTilts = next;
			tilts = [...next];
			if (needsUpdate) scheduleAnimate();
		}

		function handleScroll() {
			const viewportH = window.innerHeight;
			// The "active zone" threshold — the record whose center crosses here becomes active
			const doneLine = viewportH * 0.5;
			// Wider distance = more scroll to complete the tilt, more breathing room
			const tiltDistance = 320;

			// Active = the last record (highest index) whose center is above doneLine
			let newActiveIndex = 0;
			for (let i = 0; i < recordEls.length; i++) {
				const el = recordEls[i];
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const center = rect.top + rect.height / 2;
				if (center < doneLine) {
					newActiveIndex = i;
				} else {
					break;
				}
			}
			activeIndex = newActiveIndex;

			// Symmetric tilt targets: both approaching and leaving records ease through
			// the same distance curve. The lerp loop handles the actual smoothing.
			targetTilts = recordEls.map((el, i) => {
				if (i === activeIndex) return 0;
				if (!el) return 70;
				const rect = el.getBoundingClientRect();
				const center = rect.top + rect.height / 2;
				const dist = Math.abs(center - doneLine);
				return Math.min(70 * (dist / tiltDistance), 70);
			});

			scheduleAnimate();
		}

		handleScroll();
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (rafId) cancelAnimationFrame(rafId);
		};
	});
</script>

<div class="record-stack">
	{#each displayItems as playlist, index}
		{@const color = colors[index % colors.length]}
		{@const imageUrl = playlist?.images?.[0]?.url}
		{@const tilt = tilts[index] ?? (index === 0 ? 0 : 70)}

		<div
			class="record-tilt"
			style="z-index: {getZIndex(index, activeIndex, displayItems.length)}; transform: perspective(800px) rotateX({tilt}deg);"
			bind:this={recordEls[index]}
		>
			<a
				sveltekit:prefetch
				href={`/playlist/${playlist.id}`}
				class="record-face"
				class:spinning={index === activeIndex}
				style="background-color: {color};"
			>
				{#if imageUrl}
					<div class="record-image" style="background-image: url('{imageUrl}');" />
				{:else}
					<div class="record-image" />
				{/if}
				<div class="record-hole" />
			</a>
		</div>
	{/each}
</div>

<style>
	.record-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10rem 0 32rem;
		width: 100%;
	}

	.record-tilt {
		width: 320px;
		height: 320px;
		margin-bottom: -160px;
		/* No CSS transition — tilt is driven directly by scroll position */
		will-change: transform;
	}

	.record-face {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		position: relative;
		overflow: hidden;
	}

	.record-face.spinning {
		animation: spin 8s linear infinite;
	}

	.record-image {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background-size: cover;
		background-position: center;
	}

	.record-hole {
		position: absolute;
		width: 33.33%;
		height: 33.33%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 50%;
		z-index: 1;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
