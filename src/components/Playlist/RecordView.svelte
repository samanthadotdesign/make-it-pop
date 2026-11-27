<script>
	import { browser } from '$app/env';
	import { base } from '$app/paths';
	import { getContext, onMount, tick } from 'svelte';
	import { listeningSessionContext, primeListeningAudio } from '@utils/listeningAudio.js';
	import { activeShelfRecord } from '@utils/shelfCatalog.js';
	import { shelfPalette } from '@utils/shelfPalette.js';
	import { followVinylShadow } from '@utils/vinylTitleShadow.js';
	import NowPlaying from './NowPlaying.svelte';
	import RecordArtwork from './RecordArtwork.svelte';
	import ShelfIcon from './ShelfIcon.svelte';

	export let items;

	const listening = getContext(listeningSessionContext);
	const shelfPerspective = 1200;
	const backgroundColors = ['--sky', '--ground', '--glow', '--reflection'];

	let scroller;
	let row;
	let desktop = false;
	let reducedMotion = false;
	let restored = false;
	let position = 0;
	let scrollOffset = 0;
	let pitch = 1;
	let endStart = 0;
	let endPitch = 1;
	let wheelTimer;
	let wheelScrolling = false;
	let drag;
	let suppressClick = false;
	let shaderSurfaces = {};
	let hoveredIndex;

	$: lastIndex = Math.max(0, items.length - 1);
	$: scrollIndex = Math.max(0, Math.min(lastIndex, Math.round(position)));
	$: activeIndex = desktop && hoveredIndex !== undefined ? hoveredIndex : scrollIndex;
	$: focusPosition = desktop && hoveredIndex !== undefined ? hoveredIndex : position;
	$: focusOffset = (activeIndex + stackShift(activeIndex - position)) * pitch - scrollOffset;
	$: endProgress = desktop
		? Math.max(0, Math.min(1, (position - endStart) / Math.max(1, lastIndex - endStart)))
		: 0;
	$: current = items[activeIndex];
	$: palettes = items.map(shelfPalette);
	$: backgroundStyle = shelfBackground(palettes, reducedMotion ? activeIndex : focusPosition);
	$: if (restored && current) activeShelfRecord.set(current);

	function shelfBackground(palettes, position) {
		const offset = Math.max(0, Math.min(palettes.length - 1, position));
		const index = Math.floor(offset);
		const from = palettes[index] ?? shelfPalette({});
		const to = palettes[index + 1] ?? from;
		const weight = (offset - index) * 100;
		const colors = backgroundColors.map((name, index) =>
			weight
				? `${name}: color-mix(in oklab, ${from[index]}, ${to[index]} ${weight}%)`
				: `${name}: ${from[index]}`
		);
		const phase = offset * 1.4;
		return [
			...colors,
			`--glow-x: ${46 + Math.sin(phase) * 24}%`,
			`--glow-y: ${30 - Math.cos(phase) * 12}%`
		].join('; ');
	}

	function endShift(index, start, step, endStep) {
		return Math.max(0, index - start) * (step - endStep);
	}

	function scrollTo(index, behavior = 'instant') {
		const target = Math.max(0, Math.min(lastIndex, index));
		const offset = target * pitch - (desktop ? endShift(target, endStart, pitch, endPitch) : 0);
		scroller.scrollTo(desktop ? { left: offset, behavior } : { top: offset, behavior });
	}

	function scrollPosition(event) {
		if (event?.type === 'scroll') hoveredIndex = undefined;
		scrollOffset = desktop ? scroller.scrollLeft : scroller.scrollTop;
		const endOffset = endStart * pitch;
		position =
			desktop && scrollOffset > endOffset
				? endStart + (scrollOffset - endOffset) / endPitch
				: scrollOffset / pitch;
	}

	function hoverRecord(event, index) {
		if (desktop && event.pointerType === 'mouse' && !drag?.active && !wheelScrolling) {
			hoveredIndex = index;
		}
	}

	function focusRecord(index) {
		if (desktop) hoveredIndex = index;
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
			scrollPosition();
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
			End: lastIndex
		};
		if (!(event.key in indexes)) return;
		event.preventDefault();
		hoveredIndex = undefined;
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
			hoveredIndex = undefined;
			scroller.setPointerCapture(event.pointerId);
			scroller.style.scrollSnapType = 'none';
		}
		if (drag.active) scroller.scrollLeft = drag.left - delta;
	}

	function endDrag() {
		if (!drag) return;
		if (drag.active) {
			scrollPosition();
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

	function stackShift(distance) {
		return -Math.sign(distance) * Math.max(0, Math.abs(distance) - 3) * 0.36;
	}

	function recordPose(distance, pitch, focusDistance) {
		const magnitude = Math.abs(distance);
		const focusMagnitude = Math.abs(focusDistance);
		const angle = Math.min(70, Math.max(0, focusMagnitude * 34.9 - 13.4));
		const side = Math.sign(focusDistance);
		const focusShift = stackShift(focusDistance);
		// Keep the focused record in its slot and fan out evenly on both sides.
		const shift = stackShift(distance - focusDistance) + focusShift;
		const cameraOffset = (focusDistance + focusShift) * pitch;
		const depth = -Math.min(96, Math.max(0, focusMagnitude - 1) * 15);
		// Keep the outside edges nearer to the shared camera on either side of the front record.
		const sightline = (Math.atan2(cameraOffset, shelfPerspective - depth) * 180) / Math.PI;
		return [
			`--tilt: ${Math.sign(distance) * Math.min(70, Math.max(0, magnitude * 34.9 - 13.4))}deg`,
			`--stack-offset: ${shift}`,
			`--camera-offset: ${cameraOffset}px`,
			`--record-depth: ${depth}px`,
			`--record-yaw: ${focusDistance === 0 ? 0 : -side * angle - sightline}deg`
		].join('; ');
	}

	onMount(() => {
		const desktopQuery = window.matchMedia('(min-width: 768px)');
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotionPreference = () => (reducedMotion = motionQuery.matches);
		const restoredIndex = Math.max(
			0,
			items.findIndex(({ id }) => id === $activeShelfRecord?.id)
		);
		position = restoredIndex;

		async function measure() {
			const index = Math.round(position);
			desktop = desktopQuery.matches;
			if (!desktop) hoveredIndex = undefined;
			const { width, height } = row.firstElementChild?.getBoundingClientRect() ?? {};
			if (!width || !height) return;
			pitch = Math.max(1, desktop ? width : height);

			if (desktop) {
				// Spread the shorter scroll range across the final records so each can still snap.
				const maxScroll = scroller.scrollWidth - scroller.clientWidth;
				const reduction = Math.max(0, lastIndex * pitch - maxScroll);
				const endSteps = Math.min(lastIndex, Math.ceil((2 * reduction) / pitch));
				endStart = lastIndex - endSteps;
				endPitch = endSteps ? (maxScroll - endStart * pitch) / endSteps : pitch;
			}

			await tick();
			if (!scroller) return;
			if (!wheelScrolling && !drag) scrollTo(index);
			scrollPosition();
		}

		measure();
		syncMotionPreference();
		restored = true;
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		desktopQuery.addEventListener('change', measure);
		motionQuery.addEventListener('change', syncMotionPreference);
		scroller.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			observer.disconnect();
			desktopQuery.removeEventListener('change', measure);
			motionQuery.removeEventListener('change', syncMotionPreference);
			scroller.removeEventListener('wheel', handleWheel);
			clearTimeout(wheelTimer);
		};
	});
</script>

<div
	class="shelf"
	class:has-now-playing={!!$listening}
	class:hover-selected={desktop && hoveredIndex !== undefined}
	style="--shelf-perspective: {shelfPerspective}px; --focus-offset: {focusOffset}px; --end-progress: {endProgress}; --record-steps: {lastIndex}; {backgroundStyle}"
>
	<div class="shelf-light" aria-hidden="true" />

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
				{@const focusDistance = index - focusPosition}
				<li
					class="slot"
					style="z-index: {index === activeIndex
						? items.length * 10 + 1
						: -Math.round(Math.abs(focusDistance) * 10) + items.length * 10}"
					style:scroll-margin-left={desktop
						? `${endShift(index, endStart, pitch, endPitch)}px`
						: undefined}
				>
					<a
						class="disc"
						sveltekit:prefetch
						href={browser ? `${base}${record.path}` : undefined}
						aria-label={record.artist ? `${record.name} by ${record.artist}` : record.name}
						aria-current={index === activeIndex ? 'true' : undefined}
						style={recordPose(distance, pitch, focusDistance)}
						draggable="false"
						on:pointermove={(event) => hoverRecord(event, index)}
						on:focus={() => focusRecord(index)}
						on:click={(event) => recordClick(event, record)}
					>
						<RecordArtwork
							{record}
							spinning={index === activeIndex}
							smoothSpin={desktop}
							{reducedMotion}
							animate={index === activeIndex}
							beveled
							on:surface={(event) => (shaderSurfaces[record.id] = event.detail.canvas)}
						/>
					</a>
				</li>
			{/each}
		</ol>
	</div>

	{#if current}
		<div
			class="shelf-controls"
			style="--vinyl-shadow-base: {current.treatment?.color ?? current.color ?? current.tint}"
			use:followVinylShadow={{ desktop, canvas: shaderSurfaces[current.id] }}
		>
			<div class="toolbar">
				<p aria-live="polite" title={current.name}>{current.name}</p>
				<a
					class="play"
					href={browser
						? `${base}${current.path}${Array.isArray(current.tracks) ? '?play=1' : ''}`
						: undefined}
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
	.shelf {
		--toolbar-height: 72px;
		--top: 72px;
		--bottom: calc(var(--toolbar-height) + env(safe-area-inset-bottom));
		position: fixed;
		inset: 0;
		overflow: hidden;
		color: #151515;
		background: radial-gradient(
				ellipse at var(--glow-x) var(--glow-y),
				color-mix(in oklab, var(--glow) 67%, transparent) 0%,
				transparent 63%
			),
			radial-gradient(
				ellipse at 100% 88%,
				color-mix(in oklab, var(--reflection) 60%, transparent) 0%,
				transparent 60%
			),
			linear-gradient(152deg, var(--sky), var(--ground));
	}

	.shelf-light {
		position: absolute;
		inset: -18%;
		pointer-events: none;
		background: radial-gradient(
				ellipse 38% 24% at 22% 72%,
				color-mix(in oklab, var(--reflection) 55%, transparent),
				transparent
			),
			radial-gradient(
				ellipse 36% 25% at 77% 35%,
				color-mix(in oklab, var(--glow) 32%, transparent),
				transparent
			);
		animation: shelf-light-drift 24s ease-in-out infinite alternate;
	}

	@keyframes shelf-light-drift {
		from {
			transform: translate3d(-5%, 5%, 0) rotate(-9deg);
		}

		to {
			transform: translate3d(7%, -4%, 0) rotate(11deg);
		}
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
		transform: translate(-50%, -50%) perspective(800px) rotateX(var(--tilt));
		transform-style: preserve-3d;
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
			--top: 72px;
			--bottom: 72px;
			--record-size: min(320px, 40dvh);
			--record-axis: max(calc(var(--record-size) / 2 + 32px), 17.75vw);
			--record-center-y: max(calc(var(--top) + var(--record-size) / 2), 48dvh);
		}

		.now-playing-row {
			inset: 12px 17px auto auto;
			width: 320px;
			padding-inline: 0;
		}

		.scroller {
			--size: var(--record-size);
			--pitch: clamp(105px, 12.9vw, 170px);
			--axis: var(--record-axis);
			--available: 100vw;
			--edge-fade: clamp(120px, 19vw, 280px);
			--edge-mask: linear-gradient(
				to right,
				transparent,
				#000 calc(var(--edge-fade) * var(--end-progress)),
				#000 calc(100% - var(--edge-fade) * (1 - var(--end-progress))),
				transparent
			);
			overflow: auto hidden;
			scroll-snap-type: x proximity;
			scroll-padding-top: 0;
			scroll-padding-left: calc(var(--axis) - var(--pitch) / 2);
			-webkit-mask-image: var(--shelf-mask), var(--edge-mask);
			-webkit-mask-composite: source-in;
			mask-image: var(--shelf-mask), var(--edge-mask);
			mask-composite: intersect;
		}

		.row {
			flex-direction: row;
			width: max-content;
			height: 100%;
			overflow: clip;
		}

		.row::after {
			/* Match the leading gap, while keeping short shelves scrollable. */
			flex-basis: max(
				calc(var(--axis) - var(--pitch) / 2),
				calc(
					var(--available) - var(--axis) - var(--pitch) / 2 - var(--record-steps) * var(--pitch) / 2
				)
			);
		}

		.disc {
			top: calc(var(--record-center-y) - var(--top));
			transform: translate(calc(-50% + var(--stack-offset) * var(--pitch)), -50%)
				translateX(calc(-1 * var(--camera-offset))) perspective(var(--shelf-perspective))
				translateX(var(--camera-offset)) translateZ(var(--record-depth)) rotateY(var(--record-yaw));
		}

		.hover-selected .disc {
			transition: transform 320ms ease-in-out;
		}

		.shelf-controls {
			--caption-shadow: color-mix(
				in srgb,
				var(--vinyl-shadow-sample, var(--vinyl-shadow-base)) 54%,
				#151515
			);
			inset: calc(var(--record-center-y) + var(--record-size) * 0.16) auto auto
				calc(var(--record-axis) + var(--focus-offset) + 4px);
			transform: translateX(-50%);
			width: clamp(154px, calc(var(--record-size) * 0.725), 232px);
			pointer-events: none;
		}

		.toolbar {
			gap: 0;
			height: clamp(44px, calc(var(--record-size) * 0.225), 72px);
			padding: 0 clamp(7px, calc(var(--record-size) * 0.069), 22px) 0
				clamp(12px, calc(var(--record-size) * 0.1), 32px);
			color: white;
			text-shadow: 0 1px 2px var(--caption-shadow),
				0 0 5px color-mix(in srgb, var(--caption-shadow) 54%, transparent);
			transition: text-shadow 170ms linear;
		}

		.toolbar p {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.play {
			pointer-events: auto;
		}

		.play :global(.icon) {
			filter: invert(1) drop-shadow(0 1px 2px var(--caption-shadow));
			transition: filter 170ms linear;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shelf-light {
			animation: none;
		}

		.toolbar,
		.play :global(.icon),
		.hover-selected .disc {
			transition: none;
		}
	}
</style>
