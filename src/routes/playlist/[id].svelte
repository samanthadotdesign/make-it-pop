<!-- 
1. Fetched the entire playlist (module)
2. Assigned fetchedPlaylist to the playlist object on the store
3. With current playlist id + currentTrack index -> find the trackAnalysis + audio file stored locally
 -->
<script context="module">
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status }) {
		const url = `/json/playlists/${params.id}.json`;
		const res = await fetch(url);
		return {
			props: {
				fetchedPlaylist: await res.json(), // res.json() returns a promise
				playlistId: params.id // store playlist id & name locally
			}
		};
	}
</script>

<script>
	import { playlists, playlist, trackAnalysis } from '@stores/userDataStore.js';
	import { currentTrack } from '@stores/visualizerStore.js';
	import { page } from '$app/stores';
	import EventListener from '@components/Playlist/EventListener.svelte';
	import Controls from '@components/Controls.svelte';
	import Index from '../index.svelte';

	export let fetchedPlaylist;
	export let playlistId;
	export let playlistName;

	// On runtime, fetchedPlaylist will be automatically populated from context="module" props
	$playlist = fetchedPlaylist;

	$: {
		$trackAnalysis = getTrackAnalysis($currentTrack, playlistId);
	}

	async function getTrackAnalysis(currentTrack, playlistId) {
		const trackId = $playlist['items'][currentTrack]['track']['id'];
		const url = `/json/audio-analysis/${playlistId}/${trackId}.json`;
		const res = await fetch(url);
		const result = await res.json();
		return result;
	}

	function getPlaylistName(playlistId) {
		const playlistsArray = $playlists.items;
		const currentPlaylist = playlistsArray.find((playlist) => playlist.id == playlistId);
		return currentPlaylist['name'];
	}
	playlistName = getPlaylistName(playlistId);
</script>

<EventListener />
<Controls title={playlistName} />
<h1>
	{#each $playlist.items as trackObject}
		<p>{trackObject.track.name}</p>
	{/each}
</h1>
