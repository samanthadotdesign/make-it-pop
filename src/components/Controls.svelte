<script>
	import Searchbar from '@components/Searchbar.svelte';
	export let title;
	import { playStatus, setAudioIndex } from '@stores/visualizerStore.js';
	import { play, pause, previous, next } from '@utils/spotifyAPI';
	import { session, page } from '$app/stores';
	import { playlist, previousTrackId } from '@stores/userDataStore';

	import { currentTrack } from '@stores/visualizerStore.js';

	const { params } = $page;
	const { id: playlistId } = params;

	$: trackId = $playlist?.tracks['items']?.[$currentTrack]?.['track']['id'];

	// Change player signal from play to pause
	function togglePlay() {
		$playStatus = !$playStatus;
		if ($playStatus) {
			const context_uri = `spotify:playlist:${playlistId}`;
			const uri = `spotify:track:${trackId}`;
			let args = null;

			// If we are on a different track, start the track from the beginning
			if ($previousTrackId !== trackId) {
				args = { context_uri, offset: { uri } };
			}
			$previousTrackId = trackId;
			// Else, play the track from where we paused if it's the same
			play($session, args);
		} else {
			pause($session);
		}
	}
</script>

<div class="flex justify-between items-center px-8 py-6 ">
	<h1>{title}</h1>
	<Searchbar />
</div>

<button
	id="startButton"
	class="w-24 h-24 rounded-full border-solid border-2 border-black"
	on:click={togglePlay}
>
	{#if !$playStatus}
		PLAY
	{:else}
		PAUSE
	{/if}
</button>

<div class="fixed bottom-0 left-0 right-0 flex justify-between items-center p-6">
	<button
		id="prevButton"
		on:click={() => {
			previous($session);
			setAudioIndex(false);
		}}
	>
		prev
	</button>
	<button
		id="nextButton"
		on:click={() => {
			next($session);
			setAudioIndex(true);
		}}
	>
		next
	</button>
</div>
