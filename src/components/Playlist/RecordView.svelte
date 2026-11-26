<script>
	import { base } from '$app/paths';
	import { getContext, onMount } from 'svelte';
	import { listeningSessionContext, primeListeningAudio } from '@utils/listeningAudio.js';
	import { activeShelfRecord } from '@utils/shelfCatalog.js';
	import NowPlaying from './NowPlaying.svelte';
	import RecordArtwork from './RecordArtwork.svelte';
	import ShelfIcon from './ShelfIcon.svelte';

	export let items;

	const listening = getContext(listeningSessionContext);

	let scroller;
	let row;
	let desktop = false;
	let restored = false;
	let position = 0;
	let pitch = 1;
	let wheelTimer;
	let wheelScrolling = false;
	let drag;
	let suppressClick = false;

	$: activeIndex = Math.max(0, Math.min(items.length - 1, Math.round(position)));
	$: current = items[activeIndex];
	$: if (restored && current) activeShelfRecord.set(current);

	function scrollTo(index, behavior = 'instant') {
		const offset = Math.max(0, Math.min(items.length - 1, index)) * pitch;
		scroller.scrollTo(desktop ? { left: offset, behavior } : { top: offset, behavior });
	}

	function scrollPosition() {
		position = (desktop ? scroller.scrollLeft : scroller.scrollTop) / pitch;
	}

	function handleWheel(event) {
		if (!desktop || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
		event.preventDefault();
		wheelScrolling = true;
		scroller.style.scrollSnapType = 'none';
		const multiplier =
			event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientWidth : 1;
		scroller.scrollLeft += event.deltaY * multiplier;
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => {
			wheelScrolling = false;
			scroller.style.scrollSnapType = '';
			scrollTo(Math.round(position), 'smooth');
		}, 130);
	}

	function handleKey(event) {
		const previous = desktop ? 'ArrowLeft' : 'ArrowUp';
		const next = desktop ? 'ArrowRight' : 'ArrowDown';
		const indexes = {
			[previous]: activeIndex - 1,
			[next]: activeIndex + 1,
			Home: 0,
			End: items.length - 1
		};
		if (!(event.key in indexes)) return;
		event.preventDefault();
		scrollTo(indexes[event.key], 'smooth');
	}

	function beginDrag(event) {
		if (!desktop || event.pointerType !== 'mouse' || event.button !== 0) return;
		suppressClick = false;
		drag = { x: event.clientX, left: scroller.scrollLeft, active: false };
	}

	function moveDrag(event) {
		if (!drag) return;
		const delta = event.clientX - drag.x;
		if (!drag.active && Math.abs(delta) > 7) {
			drag.active = true;
			scroller.setPointerCapture(event.pointerId);
			scroller.style.scrollSnapType = 'none';
		}
		if (drag.active) scroller.scrollLeft = drag.left - delta;
	}

	function endDrag() {
		if (!drag) return;
		if (drag.active) {
			suppressClick = true;
			scroller.style.scrollSnapType = '';
			scrollTo(Math.round(position), 'smooth');
		}
		drag = undefined;
	}

	function recordClick(event, record) {
		if (suppressClick && event.detail > 0) {
			suppressClick = false;
			event.preventDefault();
			return;
		}
		$activeShelfRecord = record;
	}

	function tilt(distance, isDesktop) {
		const magnitude = Math.abs(distance);
		const angle = Math.min(70, isDesktop ? magnitude * 64 : Math.max(0, magnitude * 34.9 - 13.4));
		return `perspective(800px) rotate${isDesktop ? 'Y' : 'X'}(${distance < 0 ? -angle : angle}deg)`;
	}

	onMount(() => {
		const desktopQuery = window.matchMedia('(min-width: 768px)');
		const restoredIndex = Math.max(
			0,
			items.findIndex(({ id }) => id === $activeShelfRecord?.id)
		);
		position = restoredIndex;

		function measure() {
			const index = Math.round(position);
			desktop = desktopQuery.matches;
			const first = row.firstElementChild;
			pitch = Math.max(1, desktop ? first.offsetWidth : first.offsetHeight);
			if (!wheelScrolling && !drag) scrollTo(index);
			scrollPosition();
		}

		measure();
		restored = true;
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		desktopQuery.addEventListener('change', measure);
		scroller.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			observer.disconnect();
			desktopQuery.removeEventListener('change', measure);
			scroller.removeEventListener('wheel', handleWheel);
			clearTimeout(wheelTimer);
		};
	});
</script>

<div
	class="shelf"
	class:has-now-playing={!!$listening}
	style="--shelf-tint: {current?.tint ?? '#7a77e8'}"
>
	{#if $listening}
		<div class="now-playing-row">
			<NowPlaying session={$listening} />
		</div>
	{/if}

	<div
		class="scroller"
		bind:this={scroller}
		on:scroll={scrollPosition}
		on:keydown={handleKey}
		on:pointerdown={beginDrag}
		on:pointermove={moveDrag}
		on:pointerup={endDrag}
		on:pointercancel={endDrag}
		role="region"
		aria-label="Record shelf"
		tabindex="0"
	>
		<ol bind:this={row} class="row">
			{#each items as record, index (record.id)}
				{@const distance = index - position}
				<li
					class="slot"
					style="z-index: {index === activeIndex
						? items.length * 10 + 1
						: -Math.round(Math.abs(distance) * 10) + items.length * 10}"
				>
					<a
						class="disc"
						sveltekit:prefetch
						href="{base}{record.path}"
						aria-label={record.artist ? `${record.name} by ${record.artist}` : record.name}
						aria-current={index === activeIndex ? 'true' : undefined}
						style="transform: translate(-50%, -50%) {tilt(distance, desktop)}"
						draggable="false"
						on:click={(event) => recordClick(event, record)}
					>
						<RecordArtwork {record} spinning={index === activeIndex} />
					</a>
				</li>
			{/each}
		</ol>
	</div>

	{#if current}
		<div class="shelf-controls">
			<div class="toolbar">
				<p aria-live="polite">{current.name}</p>
				<a
					class="play"
					href="{base}{current.path}{Array.isArray(current.tracks) ? '?play=1' : ''}"
					aria-label="Play {current.name}"
					on:click={() => Array.isArray(current.tracks) && primeListeningAudio()}
				>
					<ShelfIcon name="play" />
				</a>
			</div>
		</div>
	{/if}
</div>

<style>
	@property --shelf-tint {
		syntax: '<color>';
		inherits: true;
		initial-value: #7a77e8;
	}

	.shelf {
		--wash: color-mix(in srgb, var(--shelf-tint) 75%, white);
		--ground: #999;
		--toolbar-height: 72px;
		--top: 72px;
		--bottom: calc(var(--toolbar-height) + env(safe-area-inset-bottom));
		position: fixed;
		inset: 0;
		color: #151515;
		background: linear-gradient(var(--wash), var(--ground));
		transition: --shelf-tint 350ms ease;
	}

	.has-now-playing {
		--top: calc(100px + env(safe-area-inset-top));
	}

	.scroller {
		--size: min(320px, calc(100vw - 48px), 43dvh);
		--pitch: clamp(124px, 39vw, 172px);
		--axis: clamp(105px, calc(34.56dvh - var(--top)), 275px);
		--available: calc(100dvh - var(--top) - var(--bottom));
		--fade-depth: min(56px, 14%);
		--shelf-mask: linear-gradient(
			transparent,
			black var(--fade-depth),
			black calc(100% - var(--fade-depth)),
			transparent
		);
		position: absolute;
		inset: var(--top) 0 var(--bottom);
		overflow: hidden auto;
		scrollbar-width: none;
		overscroll-behavior: contain;
		scroll-snap-type: y proximity;
		scroll-padding-top: calc(var(--axis) - var(--pitch) / 2);
		-webkit-mask-image: var(--shelf-mask);
		mask-image: var(--shelf-mask);
	}

	.scroller::-webkit-scrollbar {
		display: none;
	}

	.scroller:focus-visible {
		outline: 2px solid #222;
		outline-offset: -4px;
	}

	.row {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.row::before {
		content: '';
		flex: 0 0 max(0px, calc(var(--axis) - var(--pitch) / 2));
	}

	.row::after {
		content: '';
		flex: 0 0 max(0px, calc(var(--available) - var(--axis) - var(--pitch) / 2));
	}

	.slot {
		position: relative;
		flex: 0 0 var(--pitch);
		scroll-snap-align: start;
		pointer-events: none;
	}

	.disc {
		position: absolute;
		left: 50%;
		top: 50%;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		pointer-events: auto;
		-webkit-user-drag: none;
		user-select: none;
	}

	.disc:focus-visible {
		outline: 2px solid #222;
		outline-offset: 4px;
	}

	.shelf-controls {
		position: absolute;
		z-index: 2;
		inset: auto 0 0;
	}

	.now-playing-row {
		position: absolute;
		z-index: 2;
		inset: calc(36px + env(safe-area-inset-top)) 0 auto;
		padding-inline: 16px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: calc(var(--toolbar-height) + env(safe-area-inset-bottom));
		padding: 0 22px env(safe-area-inset-bottom) 32px;
	}

	.play {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 50%;
	}

	.play:hover {
		background: #15151513;
	}

	@media (min-width: 768px) {
		.shelf {
			--bottom: 105px;
			--shelf-controls-inset: clamp(20px, 8dvh, 65px);
		}

		.has-now-playing {
			--top: 72px;
			--bottom: 161px;
		}

		.now-playing-row {
			inset: auto 0 calc(var(--shelf-controls-inset) + 80px);
		}

		.scroller {
			--size: min(320px, 40dvh);
			--pitch: clamp(185px, 21.5vw, 290px);
			--axis: 55vw;
			--available: 100vw;
			overflow: auto hidden;
			scroll-snap-type: x proximity;
			scroll-padding-top: 0;
			scroll-padding-left: calc(var(--axis) - var(--pitch) / 2);
		}

		.row {
			flex-direction: row;
			width: max-content;
			height: 100%;
		}

		.disc {
			top: clamp(calc(var(--size) / 2), calc(52.5dvh - var(--top)), 75%);
		}

		.shelf-controls {
			inset: auto 50% var(--shelf-controls-inset) auto;
			transform: translateX(50%);
			width: min(440px, calc(100vw - 64px));
		}

		.toolbar {
			height: 74px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shelf {
			transition: none;
		}
	}
</style>
