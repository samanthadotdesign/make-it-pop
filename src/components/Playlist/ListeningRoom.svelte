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
	let infoOpen = false;
	let status = '';

	$: if (audio) {
		const key = visible ? `${initialRecord.id}:${autoplay}:${returnToSession}` : null;
		if (arrivalKey !== key) {
			arrivalKey = key;
			if (visible) openRecord(initialRecord, autoplay, returnToSession);
		}
	}
	$: track = record.tracks[trackIndex];
	$: canPause = playing || cueing || exchange?.autoplay;
	$: canToggle = !!track?.src && (!exchange || !!exchange.record);
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

	function inspectDeck() {
		if (paused && !exchange) deck.inspectPaused();
	}

	async function playTrack(index, restart = false) {
		const next = record.tracks[index];
		if (!next?.src || !audio) return;

		trackIndex = index;
		const thisRequest = ++request;
		const source = `${base}${next.src}`;
		if (audio.getAttribute('src') !== source) audio.src = source;
		else if (restart || audio.ended) audio.currentTime = 0;

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

	function selectRecord(next) {
		recordSource = null;
		record = next;
		trackIndex = next.tracks.findIndex(({ src }) => src);
		if (visible) activeShelfRecord.set(next);
	}

	function openRecord(next, playOnArrival, returning) {
		if (returning && started) {
			// The indicator may have been clicked as the deck was swapping records.
			if (next.id !== record.id) updatePlayerUrl(record);
		} else if (next.id !== record.id) {
			resetFromNavigation(next, playOnArrival);
		} else if (playOnArrival && !playing && !cueing && !exchange?.autoplay) {
			if (exchange?.record) exchange.autoplay = true;
			else start();
		}
	}

	function updatePlayerUrl(next) {
		goto(`${base}${next.path}`, {
			replaceState: true,
			noscroll: true,
			keepfocus: true
		}).catch((error) => console.error('Could not update the selected record URL:', error));
	}

	async function resetFromNavigation(next, playOnArrival) {
		cancelPlayback();
		const navigationRequest = request;
		exchange = null;
		started = false;
		paused = false;
		infoOpen = false;
		status = '';
		selectRecord(next);
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
		// The old pressing is out of frame. Let the new artwork reach the deck before it inserts.
		await tick();
		if (exchange !== swap) return;
		exchange = null;
		status = '';
		if (swap.autoplay) start();
		// Leave the shelf in place if a record finishes while the listener is browsing.
		if (visible && !$navigating) updatePlayerUrl(swap.record);
	}

	function chooseTrack(index) {
		if (exchange) return;
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
		audio.addEventListener('ended', onEnded);
		audio.addEventListener('error', onAudioError);
		return () => {
			cancelPlayback();
			exchange = null;
			audio.removeEventListener('ended', onEnded);
			audio.removeEventListener('error', onAudioError);
			if (audio.getAttribute('src')) audio.currentTime = 0;
		};
	});
</script>

<svelte:head>
	{#if visible}<title>{record.name} · make it pop</title>{/if}
</svelte:head>

<main class="room">
	{#if record.treatment}
		{#key record.id}
			<div class="texture" aria-hidden="true">
				<RecordArtwork {record} on:surface={(event) => (recordSource = event.detail.canvas)} />
			</div>
		{/key}
	{/if}

	<div class="model">
		{#key deckVersion}
			<TurntableScene
				bind:this={deck}
				recordColor={record.treatment?.color ?? record.color}
				labelColor={record.treatment?.label}
				{recordSource}
				{visible}
				inspectable={paused && !exchange}
				on:cue={onCue}
				on:exchange={onExchange}
				on:inspect={inspectDeck}
			/>
		{/key}
	</div>

	<div class="controls">
		{#if infoOpen}
			<section id="playlist-info" class="info" aria-label="Record details">
				<h1>{record.name}</h1>
				{#if record.artist}
					<p>{record.artist}{record.year ? ` · ${record.year}` : ''}</p>
				{/if}
				{#if record.credit}<p>{record.credit}</p>{/if}
				{#if record.source || record.license}
					<p class="credits">
						{#if record.source}<a href={record.source} target="_blank" rel="noreferrer"
								>Original release</a
							>{/if}
						{#if record.license}<a href={record.license.url} target="_blank" rel="noreferrer"
								>{record.license.name}</a
							>{/if}
					</p>
				{/if}

				<ol class="tracks">
					{#each record.tracks as item, index}
						<li>
							{#if item.src}
								<button
									type="button"
									class="track"
									aria-current={index === trackIndex ? 'true' : undefined}
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
											>Unavailable here{#if record.missingTrackSource}
												· <a href={record.missingTrackSource} target="_blank" rel="noreferrer"
													>Original track</a
												>{/if}</small
										></span
									>
								</span>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<div class="toolbar">
			<div class="title">
				<p>{record.name}</p>
				{#if status || (playing && track)}
					<p class="track-title" aria-live="polite">{status || track?.title}</p>
				{/if}
			</div>
			<button
				class="icon-button details"
				class:expanded={infoOpen}
				type="button"
				aria-label={infoOpen ? 'Hide record details' : 'Show record details'}
				aria-expanded={infoOpen}
				aria-controls={infoOpen ? 'playlist-info' : undefined}
				on:click={() => (infoOpen = !infoOpen)}
			>
				<ShelfIcon name="plus" />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label={canPause ? 'Pause' : 'Play'}
				disabled={!canToggle}
				on:click={togglePlayback}
			>
				<ShelfIcon name={canPause ? 'pause' : 'play'} />
			</button>
		</div>
	</div>
</main>

<style>
	.room {
		--bottom: calc(72px + env(safe-area-inset-bottom));
		--player-background: #c8c8c8;
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

	.model {
		position: absolute;
		inset: 72px 0 var(--bottom);
		overflow: hidden;
	}

	.controls {
		position: absolute;
		z-index: 1;
		inset: auto 0 0;
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
	.expanded :global(.icon) {
		transform: rotate(45deg);
	}

	.info {
		max-height: min(50dvh, 420px);
		overflow: auto;
		overscroll-behavior: contain;
		padding: 24px 32px 12px;
		border-top: 1px solid #0002;
		background: #e7e7e7;
	}

	h1 {
		font-size: 20px;
	}

	.credits {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		margin-top: 8px;
		font-size: 14px;
	}

	.info a {
		text-decoration: underline;
	}

	.tracks {
		margin-top: 12px;
	}

	.track {
		display: grid;
		grid-template-columns: 2ch 1fr;
		gap: 12px;
		width: 100%;
		padding: 8px 4px;
		text-align: left;
		border-bottom: 1px solid #0002;
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
		.model {
			bottom: calc(clamp(20px, 8dvh, 65px) + 82px);
		}

		.controls {
			--bottom: 74px;
			inset: auto auto clamp(20px, 8dvh, 65px) 50%;
			transform: translateX(-50%);
			width: min(440px, calc(100vw - 64px));
		}

		.info {
			border: 1px solid #ffffff70;
			border-radius: 8px;
			backdrop-filter: blur(12px);
			margin-bottom: 8px;
		}
	}
</style>
