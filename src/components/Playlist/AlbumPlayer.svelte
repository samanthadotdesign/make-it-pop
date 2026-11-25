<script>
	import { onMount } from 'svelte';

	export let album;

	const { tracks } = album;
	let trackIndex = 0;
	let audio;
	let position = 0;
	let duration = 0;
	let playing = false;
	let finished = false;
	let message = '';
	let playRequest = 0;

	$: currentTrack = tracks[trackIndex];
	$: hasMissingTracks = tracks.some((track) => !track.src);

	onMount(() => {
		const media = audio;
		return () => {
			playRequest++;
			media.pause();
			media.removeAttribute('src');
			media.load();
		};
	});

	function formatTime(seconds) {
		const time = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
		return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
	}

	async function playTrack(index) {
		const track = tracks[index];
		if (!track) return;
		if (!track.src) {
			message = `“${track.title}” is unavailable here. You can find it on the original release.`;
			return;
		}

		const request = ++playRequest;
		message = '';
		if (audio.getAttribute('src') !== track.src) {
			trackIndex = index;
			playing = false;
			position = 0;
			duration = 0;
			audio.src = track.src;
		} else if (audio.error) {
			audio.load();
		} else if (audio.ended) {
			audio.currentTime = 0;
		}
		finished = false;

		try {
			await audio.play();
		} catch (error) {
			if (request === playRequest && error.name !== 'AbortError') {
				message = 'This track could not start. Try playing it again.';
			}
		}
	}

	function togglePlayback() {
		if (!audio.paused) {
			playRequest++;
			audio.pause();
			return;
		}
		playTrack(finished ? 0 : trackIndex);
	}

	function advanceAfterTrack() {
		playing = false;
		if (trackIndex + 1 === tracks.length) {
			finished = true;
			return;
		}
		playTrack(trackIndex + 1);
	}
</script>

<main class="album" style="--label: {album.color}">
	<section class="turntable" aria-label="Album player">
		<div class="disc" class:playing aria-hidden="true">
			<div class="label">
				<span>{album.artist}</span>
				<i />
				<strong>{album.name}</strong>
			</div>
		</div>

		<div class="summary">
			<h1>{album.name}</h1>
			<p>{album.artist} · {album.year}</p>
			{#if album.credit}<p class="release-credit">{album.credit}</p>{/if}
		</div>

		<p class="now-playing" aria-live="polite">
			{#if finished}Album complete{:else}{currentTrack.title}{/if}
		</p>

		<div class="controls">
			<button
				type="button"
				disabled={!tracks[trackIndex - 1]?.src}
				on:click={() => playTrack(trackIndex - 1)}>Previous</button
			>
			<button type="button" class="play" disabled={!currentTrack.src} on:click={togglePlayback}>
				{playing
					? 'Pause'
					: finished
					? 'Play again'
					: position > 0 && !audio?.ended
					? 'Resume'
					: 'Drop the needle'}
			</button>
			<button
				type="button"
				disabled={!tracks[trackIndex + 1]?.src}
				on:click={() => playTrack(trackIndex + 1)}>Next</button
			>
		</div>

		<div class="progress">
			<span>{formatTime(position)}</span>
			<input
				aria-label="Seek through track"
				type="range"
				min="0"
				max={duration || 1}
				step="0.1"
				disabled={!duration}
				bind:value={position}
			/>
			<span>{formatTime(duration)}</span>
		</div>

		{#if message}<p class="notice" role="status">{message}</p>{/if}
		<div class="credits">
			<a href={album.source}>Original release</a>
			<a href={album.license.url}>{album.license.name}</a>
		</div>

		<audio
			bind:this={audio}
			bind:currentTime={position}
			bind:duration
			preload="none"
			on:playing={() => (playing = true)}
			on:pause={() => (playing = false)}
			on:ended={advanceAfterTrack}
			on:error={() => {
				playing = false;
				message = 'This track couldn’t load. Try again or visit the original release.';
			}}
		/>
	</section>

	<section class="tracklist" aria-label="Album tracks">
		<h2>Tracklist <span>{tracks.length} tracks</span></h2>
		{#if hasMissingTracks}
			<p class="notice">
				Some tracks are only available through the <a
					href={album.missingTrackSource ?? album.source}>original release</a
				>.
			</p>
		{/if}
		<ol>
			{#each tracks as track, index}
				<li>
					<button
						type="button"
						aria-current={trackIndex === index ? 'true' : undefined}
						disabled={!track.src}
						on:click={() => playTrack(index)}
					>
						<span class="number">{String(index + 1).padStart(2, '0')}</span>
						<span>{track.title}</span>
						{#if !track.src}<small>Unavailable</small>{/if}
					</button>
				</li>
			{/each}
		</ol>
	</section>
</main>

<style>
	.album {
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(2rem, 7vw, 7rem);
		min-height: 100vh;
		padding: 6.5rem clamp(1.5rem, 7vw, 7rem) 4rem;
		background: #151513;
		color: #f5f1e9;
	}

	.turntable {
		align-self: start;
	}

	.disc {
		display: grid;
		place-items: center;
		width: min(100%, 22rem);
		aspect-ratio: 1;
		margin: 0 auto 2rem;
		border: 1px solid #53534c;
		border-radius: 50%;
		background: repeating-radial-gradient(circle, #141414 0 2px, #232323 3px 4px);
		box-shadow: 0 1rem 2rem #0008, inset 0 0 3rem #000a;
	}

	.label {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		width: 42%;
		aspect-ratio: 1;
		padding: 0.6rem;
		border-radius: 50%;
		background: var(--label);
		color: #211f1b;
		font-size: clamp(0.55rem, 1.25vw, 0.8rem);
		text-align: center;
		animation: spin 1.8s linear infinite paused;
	}

	.playing .label {
		animation-play-state: running;
	}

	.label i {
		width: 0.42rem;
		height: 0.42rem;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #151513;
	}

	h1 {
		font-size: clamp(1.9rem, 4.25vw, 3.25rem);
		line-height: 1.04;
	}

	.summary p {
		margin-top: 0.55rem;
	}

	.release-credit,
	.credits,
	.progress,
	.number,
	.notice {
		color: #c4c1b8;
	}

	.now-playing {
		margin: 1.5rem 0 0.7rem;
	}

	.controls,
	.credits,
	.progress {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.controls button {
		cursor: pointer;
		padding: 0.55rem 0.85rem;
		min-height: 2.75rem;
		border: 1px solid #77746b;
		border-radius: 2rem;
	}

	.controls .play {
		background: var(--label);
		border-color: transparent;
		color: #211f1b;
	}

	button:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.progress {
		margin: 1rem 0;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}

	.progress input {
		min-width: 4rem;
		flex: 1;
		accent-color: var(--label);
	}

	.credits,
	.notice {
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	.credits a,
	.notice a {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	h2 {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid #68675f;
		font-size: 1.4rem;
	}

	h2 span,
	.number {
		font-size: 0.8rem;
	}

	.tracklist button {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		min-height: 3rem;
		padding: 0.55rem 0.4rem;
		border-bottom: 1px solid #45443d;
		text-align: left;
		cursor: pointer;
	}

	.tracklist button[aria-current='true'] {
		color: var(--label);
	}

	.tracklist button:hover:enabled {
		background: #ffffff0b;
	}

	.tracklist small {
		margin-left: auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 44rem) {
		.album {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.label {
			animation: none;
		}
	}
</style>
