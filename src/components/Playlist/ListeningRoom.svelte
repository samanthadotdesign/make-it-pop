<script>
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { navigating } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import {
		getListeningAudio,
		playListeningAudio,
		primeListeningAudio
	} from '@utils/listeningAudio.js';
	import { activeShelfRecord, shelfRecords } from '@utils/shelfCatalog.js';
	import RecordArtwork from './RecordArtwork.svelte';
	import ShelfIcon from './ShelfIcon.svelte';
	import TurntableScene from './TurntableScene.svelte';

	export let initialRecord;
	export let autoplay = false;
	export let visible = true;
	export let returnToSession = false;
	export let nowPlaying = null;

	let record = initialRecord;
	let arrivalKey;
	let deckVersion = 0;
	let deck;
	let audio;
	let recordSource = null;
	let trackIndex = record.tracks.findIndex(({ src }) => src);
	let playing = false;
	let started = false;
	let cueing = false;
	let paused = false;
	let exchange = null;
	let request = 0;
	let preview = null;
	let infoOpen = false;
	let infoScroller;
	let infoViewportHeight = 0;
	let infoContentHeight = 0;
	let infoScrollTop = 0;
	let infoClose;
	let detailsButton;
	let playbackProgress = 0;
	let status = '';

	$: if (audio) {
		const key = visible ? `${initialRecord.id}:${autoplay}:${returnToSession}` : null;
		if (arrivalKey !== key) {
			arrivalKey = key;
			if (visible) openRecord(initialRecord, autoplay, returnToSession);
			else closePreview();
		}
	}
	$: track = record.tracks[trackIndex];
	$: canPause = playing || cueing || exchange?.autoplay;
	$: canToggle = !!track?.src && (!exchange || !!exchange.record);
	$: displayedRecord = preview?.record ?? record;
	$: displayedTrackIndex = preview?.trackIndex ?? trackIndex;
	$: showingPlayback = started && !preview;
	$: displayedCanPause = !preview && canPause;
	$: displayedCanToggle = preview ? preview.trackIndex >= 0 : canToggle;
	$: nowPlaying = started
		? { record, track, status, canPause: !!canPause, canToggle, togglePlayback }
		: null;

	function cancelPlayback() {
		request += 1;
		cueing = false;
		playing = false;
		audio?.pause();
	}

	function pause() {
		cancelPlayback();
		paused = true;
		status = '';
		deck.pause();
	}

	function start(fromGesture = false) {
		if (exchange || !record.tracks[trackIndex]?.src) return;
		if (fromGesture) primeListeningAudio();
		started = true;
		cueing = true;
		paused = false;
		status = 'Cueing record…';
		deck.start();
	}

	function togglePlayback() {
		if (exchange) exchange.autoplay = !exchange.autoplay;
		else if (playing || cueing) pause();
		else start(true);
	}

	function toggleDisplayedPlayback() {
		if (!preview) {
			togglePlayback();
			return;
		}
		if (preview.trackIndex < 0) return;
		primeListeningAudio();
		switchRecord(preview.record, true, preview.trackIndex);
	}

	function inspectDeck() {
		if (paused && !exchange) deck.inspectPaused();
	}

	async function openInfo() {
		infoScrollTop = 0;
		infoOpen = true;
		await tick();
		infoClose?.focus({ preventScroll: true });
	}

	async function closeInfo() {
		if (infoScroller) infoScroller.scrollTop = 0;
		infoOpen = false;
		await tick();
		if (visible) detailsButton?.focus({ preventScroll: true });
	}

	function updateProgress() {
		const currentSource = record.tracks[trackIndex]?.src;
		playbackProgress =
			started &&
			currentSource &&
			audio.getAttribute('src') === `${base}${currentSource}` &&
			Number.isFinite(audio.duration) &&
			audio.duration > 0
				? Math.max(0, Math.min(1, audio.currentTime / audio.duration))
				: 0;
	}

	async function playTrack(index, restart = false) {
		const next = record.tracks[index];
		if (!next?.src || !audio) return;

		trackIndex = index;
		const thisRequest = ++request;
		const source = `${base}${next.src}`;
		if (audio.getAttribute('src') !== source) {
			playbackProgress = 0;
			audio.src = source;
		} else if (restart || audio.ended) {
			playbackProgress = 0;
			audio.currentTime = 0;
		}

		try {
			await playListeningAudio();
			if (thisRequest !== request) return;
			playing = true;
			status = '';
		} catch (error) {
			if (thisRequest !== request) return;
			playing = false;
			paused = true;
			deck.pause();
			status =
				error.name === 'NotAllowedError'
					? 'Press Play to start listening.'
					: 'This track could not be played.';
		} finally {
			if (thisRequest === request) cueing = false;
		}
	}

	function onCue() {
		if (cueing) playTrack(trackIndex);
	}

	function selectRecord(next, index = next.tracks.findIndex(({ src }) => src)) {
		playbackProgress = 0;
		recordSource = null;
		record = next;
		trackIndex = index;
		if (visible && !preview) activeShelfRecord.set(next);
	}

	function openPreview(next) {
		preview = {
			record: next,
			trackIndex: next.tracks.findIndex(({ src }) => src),
			previousInfoOpen: preview?.previousInfoOpen ?? infoOpen
		};
		infoOpen = false;
		activeShelfRecord.set(next);
	}

	function closePreview() {
		if (!preview) return;
		infoOpen = preview.previousInfoOpen;
		preview = null;
	}

	function openRecord(next, playOnArrival, returning) {
		if (returning && started) {
			closePreview();
			// The indicator may have been clicked as the deck was swapping records.
			if (next.id !== record.id) updatePlayerUrl(record);
		} else if (next.id !== record.id) {
			if (started && !playOnArrival) openPreview(next);
			else switchRecord(next, playOnArrival);
		} else {
			closePreview();
			if (playOnArrival && !playing && !cueing && !exchange?.autoplay) {
				if (exchange?.record) exchange.autoplay = true;
				else start();
			}
		}
		// Clear the Play flag so browser history opens the record without starting it again.
		if (playOnArrival && !returning) updatePlayerUrl(next);
	}

	function updatePlayerUrl(next) {
		goto(`${base}${next.path}`, {
			replaceState: true,
			noscroll: true,
			keepfocus: true
		}).catch((error) => console.error('Could not update the selected record URL:', error));
	}

	async function switchRecord(next, playOnArrival, index) {
		cancelPlayback();
		const navigationRequest = request;
		exchange = null;
		started = false;
		paused = false;
		infoOpen = preview?.record.id === next.id && infoOpen;
		preview = null;
		status = '';
		selectRecord(next, index);
		deckVersion += 1;
		await tick();
		if (playOnArrival && request === navigationRequest) start();
	}

	function nextShelfRecord() {
		const current = shelfRecords.findIndex(({ id }) => id === record.id);
		for (let offset = 1; offset < shelfRecords.length; offset += 1) {
			const candidate = shelfRecords[(current + offset) % shelfRecords.length];
			if (candidate.tracks.some(({ src }) => src)) return candidate;
		}
		return null;
	}

	function onEnded() {
		const current = record.tracks[trackIndex];
		if (!playing || !audio.ended || audio.getAttribute('src') !== `${base}${current?.src}`) return;
		const nextTrack = record.tracks.findIndex(({ src }, index) => index > trackIndex && src);
		if (nextTrack >= 0) {
			playTrack(nextTrack);
			return;
		}

		cancelPlayback();
		const nextRecord = nextShelfRecord();
		exchange = { record: nextRecord, autoplay: !!nextRecord };
		status = nextRecord ? 'Changing record…' : 'Finishing record…';
		deck.unload();
	}

	async function onExchange() {
		const swap = exchange;
		if (!swap) return;
		if (!swap.record) {
			trackIndex = record.tracks.findIndex(({ src }) => src);
			exchange = null;
			status = '';
			return;
		}

		selectRecord(swap.record);
		if (preview?.record.id === swap.record.id) preview = null;
		// The old pressing is out of frame. Let the new artwork reach the deck before it inserts.
		await tick();
		if (exchange !== swap) return;
		exchange = null;
		status = '';
		if (swap.autoplay) start();
		// Leave the shelf or preview in place if a record finishes while the listener is browsing.
		if (visible && !preview && !$navigating) updatePlayerUrl(swap.record);
	}

	function chooseTrack(index) {
		if (preview) {
			preview.trackIndex = index;
			return;
		}
		if (exchange) return;
		if (index !== trackIndex) playbackProgress = 0;
		if (playing) playTrack(index, true);
		else {
			trackIndex = index;
			if (!cueing) start(true);
		}
	}

	function onAudioError() {
		if (
			!(cueing || playing) ||
			audio.getAttribute('src') !== `${base}${record.tracks[trackIndex]?.src}`
		)
			return;
		pause();
		status = 'This track could not be loaded.';
	}

	onMount(() => {
		audio = getListeningAudio();
		activeShelfRecord.set(record);
		const progressEvents = ['timeupdate', 'durationchange', 'loadedmetadata', 'emptied'];
		progressEvents.forEach((event) => audio.addEventListener(event, updateProgress));
		audio.addEventListener('ended', onEnded);
		audio.addEventListener('error', onAudioError);
		return () => {
			cancelPlayback();
			exchange = null;
			audio.removeEventListener('ended', onEnded);
			audio.removeEventListener('error', onAudioError);
			progressEvents.forEach((event) => audio.removeEventListener(event, updateProgress));
			if (audio.getAttribute('src')) audio.currentTime = 0;
		};
	});
</script>

<svelte:head>
	{#if visible}<title>{displayedRecord.name} · make it pop</title>{/if}
</svelte:head>

<svelte:window
	on:keydown={(event) => {
		if (event.key === 'Escape' && infoOpen && visible) closeInfo();
	}}
/>

<main class="room" class:playlist-open={infoOpen}>
	{#if record.treatment}
		{#key record.id}
			<div class="texture" aria-hidden="true">
				<RecordArtwork {record} on:surface={(event) => (recordSource = event.detail.canvas)} />
			</div>
		{/key}
	{/if}

	<div class="stage-viewport">
		<div class="model">
			<div class="active-deck" hidden={!!preview}>
				{#key deckVersion}
					<TurntableScene
						bind:this={deck}
						recordColor={record.treatment?.color ?? record.color}
						labelColor={record.treatment?.label}
						{recordSource}
						visible={visible && !preview}
						inspectable={paused && !exchange}
						on:cue={onCue}
						on:exchange={onExchange}
						on:inspect={inspectDeck}
					/>
				{/key}
			</div>
			{#if preview}
				{#key preview.record.id}
					<TurntableScene
						recordColor={preview.record.treatment?.color ?? preview.record.color}
						labelColor={preview.record.treatment?.label}
					/>
				{/key}
			{/if}
		</div>
	</div>

	{#if infoOpen}
		<div
			class="playlist-region"
			class:has-more-tracks={infoContentHeight - infoScrollTop > infoViewportHeight + 1}
		>
			<div
				class="playlist-scroll"
				bind:this={infoScroller}
				bind:clientHeight={infoViewportHeight}
				on:scroll={(event) => (infoScrollTop = event.currentTarget.scrollTop)}
				tabindex="0"
				role="region"
				aria-label="Playlist"
			>
				<section
					id="playlist-info"
					class="info"
					bind:offsetHeight={infoContentHeight}
					aria-label="Record details"
				>
					<button
						bind:this={infoClose}
						class="icon-button info-close"
						type="button"
						aria-label="Hide record details"
						on:click={closeInfo}
					>
						<ShelfIcon name="plus" />
					</button>
					<h1>{displayedRecord.name}</h1>
					{#if displayedRecord.artist}
						<p>
							{displayedRecord.artist}{displayedRecord.year ? ` · ${displayedRecord.year}` : ''}
						</p>
					{/if}
					{#if displayedRecord.credit}<p>{displayedRecord.credit}</p>{/if}
					{#if displayedRecord.source || displayedRecord.license}
						<p class="credits">
							{#if displayedRecord.source}<a
									href={displayedRecord.source}
									target="_blank"
									rel="noreferrer">Original release</a
								>{/if}
							{#if displayedRecord.license}<a
									href={displayedRecord.license.url}
									target="_blank"
									rel="noreferrer">{displayedRecord.license.name}</a
								>{/if}
						</p>
					{/if}

					<ol class="tracks">
						{#each displayedRecord.tracks as item, index}
							<li>
								{#if item.src}
									<button
										type="button"
										class="track"
										aria-current={index === displayedTrackIndex ? 'true' : undefined}
										on:click={() => chooseTrack(index)}
									>
										<span>{index + 1}</span>
										<span
											>{item.title}{#if item.artist}<small>{item.artist}</small>{/if}</span
										>
									</button>
								{:else}
									<span class="track unavailable">
										<span>{index + 1}</span>
										<span
											>{item.title}<small
												>Unavailable here{#if displayedRecord.missingTrackSource}
													· <a
														href={displayedRecord.missingTrackSource}
														target="_blank"
														rel="noreferrer">Original track</a
													>{/if}</small
											></span
										>
									</span>
								{/if}
							</li>
						{/each}
					</ol>
				</section>
			</div>
		</div>
	{/if}

	<div class="controls">
		{#if infoOpen && showingPlayback}
			<div
				class="progress"
				role="progressbar"
				aria-label="Playback progress"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(playbackProgress * 100)}
			>
				<div
					class="played"
					class:advancing={playing}
					style={`transform: scaleX(${playbackProgress})`}
				/>
			</div>
		{/if}
		<div class="toolbar">
			<div class="title">
				<p>{displayedRecord.name}</p>
				{#if showingPlayback && (status || (playing && track))}
					<p class="track-title" aria-live="polite">{status || track?.title}</p>
				{/if}
			</div>
			<div class="title desktop-title" aria-live="polite" aria-atomic="true">
				{#if showingPlayback}
					<p class="playback-status">{status || (playing ? 'Now playing' : 'Paused')}</p>
				{/if}
				<p>{(showingPlayback && track?.title) || displayedRecord.name}</p>
			</div>
			<button
				bind:this={detailsButton}
				class="icon-button details"
				type="button"
				aria-label="Show record details"
				aria-expanded={infoOpen}
				aria-controls={infoOpen ? 'playlist-info' : undefined}
				on:click={openInfo}
			>
				<ShelfIcon name="plus" />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label={displayedCanPause ? 'Pause' : 'Play'}
				disabled={!displayedCanToggle}
				on:click={toggleDisplayedPlayback}
			>
				<ShelfIcon name={displayedCanPause ? 'pause' : 'play'} />
			</button>
		</div>
	</div>
</main>

<style>
	.room {
		--bottom: calc(72px + env(safe-area-inset-bottom));
		--control-offset: 0px;
		--panel-height: calc(100dvh - 72px - var(--bottom) - var(--control-offset));
		--panel-peek: min(420px, calc(var(--panel-height) * 0.52));
		--player-background: #c8c8c8;
		--layout-motion: 400ms cubic-bezier(0.22, 1, 0.36, 1);
		position: fixed;
		inset: 0;
		isolation: isolate;
		color: #151515;
		background: var(--player-background);
	}

	.texture {
		position: absolute;
		inset: 72px auto auto 0;
		width: min(320px, 80vw);
		aspect-ratio: 1;
		opacity: 0;
		pointer-events: none;
	}

	.stage-viewport {
		--stage-edge-fade: linear-gradient(
			to bottom,
			transparent,
			#000 64px,
			#000 calc(100% - 64px),
			transparent
		);
		position: absolute;
		inset: 72px 0 calc(var(--bottom) + var(--control-offset));
		overflow: hidden;
		-webkit-mask-image: var(--stage-edge-fade);
		mask-image: var(--stage-edge-fade);
	}

	.model {
		position: absolute;
		inset: 0;
		transition: transform var(--layout-motion);
	}

	.active-deck {
		height: 100%;
	}

	.playlist-open .model {
		/* Lift the full-size canvas 265px at the reference's 420px panel height. */
		transform: translateY(calc(var(--panel-peek) * -265 / 420));
	}

	.controls {
		position: absolute;
		z-index: 2;
		inset: auto 0 var(--control-offset);
		background: var(--player-background);
	}

	.progress {
		position: absolute;
		inset: 0 0 auto;
		height: 2px;
		overflow: hidden;
	}

	.played {
		height: 100%;
		background: #151515;
		transform-origin: left;
	}

	.played.advancing {
		transition: transform 250ms linear;
	}

	.toolbar {
		display: flex;
		align-items: center;
		min-height: var(--bottom);
		gap: 4px;
		padding: 0 22px env(safe-area-inset-bottom) 32px;
	}

	.title {
		flex: 1;
		min-width: 0;
	}

	.desktop-title {
		display: none;
	}

	.title p {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-title {
		font-size: 13px;
		color: #414141;
	}

	.icon-button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		cursor: pointer;
		border-radius: 50%;
	}

	.icon-button:hover {
		background: #15151513;
	}
	.icon-button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.info-close :global(.icon) {
		transform: rotate(45deg);
	}

	.playlist-open .details {
		visibility: hidden;
	}

	.playlist-region {
		position: absolute;
		z-index: 1;
		inset: 72px 0 calc(var(--bottom) + var(--control-offset));
		pointer-events: none;
	}

	.playlist-scroll {
		height: 100%;
		overflow-y: auto;
		overscroll-behavior-y: contain;
		scrollbar-width: none;
		animation: reveal-playlist var(--layout-motion);
	}

	.playlist-scroll::-webkit-scrollbar {
		display: none;
	}

	@keyframes reveal-playlist {
		from {
			transform: translateY(var(--panel-peek));
		}
		to {
			transform: translateY(0);
		}
	}

	.info {
		position: relative;
		display: flow-root;
		min-height: 100%;
		/* Native scrolling consumes this space before continuing through the songs. */
		margin-top: calc(var(--panel-height) - var(--panel-peek));
		padding: 20px 32px 12px;
		border-top: 1px solid #0002;
		background: #e7e7e7;
		pointer-events: auto;
	}

	.info-close {
		position: absolute;
		top: 9px;
		right: 20px;
	}

	h1 {
		font-size: 1rem;
		padding-right: 40px;
	}

	.credits {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		font-size: 14px;
	}

	.info a {
		text-decoration: underline;
	}

	.tracks {
		margin: 24px -12px 0;
	}

	.track {
		display: grid;
		grid-template-columns: 2ch 1fr;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		text-align: left;
		border-bottom: 1px solid #0002;
	}

	.tracks li:last-child .track {
		border-bottom-color: transparent;
	}

	button.track {
		cursor: pointer;
	}
	button.track:hover,
	.track[aria-current='true'] {
		background: #0001;
	}

	.track small {
		display: block;
		font-size: 13px;
		color: #414141;
	}

	.unavailable {
		color: #4f4f4f;
	}

	@media (min-width: 768px) {
		.room {
			--bottom: 60px;
			--control-offset: 23px;
			--sidebar-width: min(440px, 35vw);
			--sidebar-inset: 32px;
			--sidebar-gap: 18px;
		}

		.stage-viewport {
			bottom: calc(clamp(20px, 8dvh, 65px) + 82px);
		}

		.model {
			/* Blend the edge of the canvas that slides into view beside the playlist. */
			mask-image: linear-gradient(to right, transparent, #000 80px);
		}

		.playlist-open .model {
			transform: translateX(calc(var(--sidebar-width) * 0.65));
		}

		.controls,
		.playlist-region {
			left: var(--sidebar-inset);
			right: auto;
			width: var(--sidebar-width);
		}

		.controls {
			border: 1px solid #15151521;
			background: #ffffff30;
		}

		.toolbar {
			min-height: calc(var(--bottom) - 2px);
			gap: 0;
			padding: 2px 4px 2px 14px;
		}

		.playlist-open .details {
			display: none;
		}

		.progress {
			inset: -1px -1px auto;
		}

		.title {
			display: none;
		}

		.desktop-title {
			display: block;
			font-size: 14px;
			line-height: 1.35;
		}

		.playback-status {
			color: #2d2d2d;
			font-size: 11px;
			line-height: 1.2;
		}

		.playlist-region {
			bottom: calc(var(--bottom) + var(--control-offset) + var(--sidebar-gap));
			overflow: hidden;
			animation: reveal-desktop-playlist var(--layout-motion);
		}

		.has-more-tracks::after {
			content: '';
			position: absolute;
			inset: auto 0 0;
			height: 90px;
			background: linear-gradient(to bottom, #e7e7e700 27%, #e7e7e794);
			pointer-events: none;
		}

		.playlist-scroll {
			animation: none;
		}

		.info {
			margin-top: 0;
			background: #e7e7e74d;
		}

		.track {
			grid-template-columns: 20px minmax(0, 1fr);
		}
	}

	@keyframes reveal-desktop-playlist {
		from {
			opacity: 0;
			transform: translateX(-16px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.model,
		.played.advancing {
			transition: none;
		}

		.playlist-region,
		.playlist-scroll {
			animation: none;
		}
	}
</style>
