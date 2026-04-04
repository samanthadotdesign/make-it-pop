<script>
	export let title;
	import { setAudioIndex } from '@stores/visualizerStore.js';
	import { play, pause, previous, next } from '@utils/spotifyAPI';
	import { session, page } from '$app/stores';
	import { playlist, previousTrackId } from '@stores/userDataStore';
	import { playStatus } from '@stores/player.js';
	import { currentTrack } from '@stores/visualizerStore.js';

	const { params } = $page;
	const { id: playlistId } = params;

	$: trackId = $playlist?.tracks['items']?.[$currentTrack]?.['track']['id'];

	function togglePlay() {
		$playStatus = !$playStatus;
		if ($playStatus) {
			const context_uri = `spotify:playlist:${playlistId}`;
			const uri = `spotify:track:${trackId}`;
			let args = null;
			if ($previousTrackId !== trackId) {
				args = { context_uri, offset: { uri } };
			}
			$previousTrackId = trackId;
			play($session, args);
		} else {
			pause($session);
		}
	}
</script>

<!-- Playlist title + play button, always 24px apart -->
<div style="position: fixed; top: 5rem; left: 2rem; z-index: 2; display: flex; flex-direction: column; gap: 24px;">
	<h1 style="color: white; font-size: 1.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
		{title}
	</h1>
	<button
		id="startButton"
		on:click={togglePlay}
		style="width: 8rem; height: 8rem; border-radius: 50%; border: 2px solid white; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); color: white; font-size: 1rem; letter-spacing: normal; cursor: pointer; align-self: flex-start;"
	>
		{#if !$playStatus}PLAY{:else}PAUSE{/if}
	</button>
</div>

<!-- Prev / Next -->
<div style="position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; z-index: 2;">
	<button
		id="prevButton"
		style="color: white; background: transparent; border: none; cursor: pointer; font-size: 1rem; letter-spacing: normal;"
		on:click={() => { previous($session); setAudioIndex(false); }}
	>prev</button>
	<button
		id="nextButton"
		style="color: white; background: transparent; border: none; cursor: pointer; font-size: 1rem; letter-spacing: normal;"
		on:click={() => { next($session); setAudioIndex(true); }}
	>next</button>
</div>
