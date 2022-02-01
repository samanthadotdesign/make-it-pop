<script context="module">
	import { randomTerm } from '@stores/visualizerStore.js';
	import { fetchVideos } from '@utils/videoAPI';
	import { getPlaylist } from '@utils/spotifyAPI';
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status, session }) {
		// If user has connected Spotify, we get the single playlist
		if (session['access_token']) {
			const { id } = params;
			const fetchedPlaylist = await getPlaylist(session, id);
			return {
				props: {
					fetchedPlaylist,
					playlistId: id,
					videos: await fetchVideos(randomTerm),
					randomTerm
				}
			};
		}
		// When user loads for the first time
		const url = `/json/playlists/${params.id}.json`;
		const res = await fetch(url);
		return {
			props: {
				fetchedPlaylist: await res.json(), // res.json() returns a promise
				playlistId: params.id, // store playlist id & name locally
				videos: await fetchVideos(randomTerm),
				randomTerm
			}
		};
	}
</script>

<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import {
		playlists,
		playlist,
		trackAnalysis,
		getPlaylistProperty,
		previousPlaylistId
	} from '@stores/userDataStore.js';
	import {
		currentTrack,
		searchTerm,
		videosData,
		videoPlaylistLength
	} from '@stores/visualizerStore.js';
	import { page } from '$app/stores';
	import EventListener from '@components/Playlist/EventListener.svelte';
	import Controls from '@components/Controls.svelte';
	import Index from '../index.svelte';
	import AudioVisualizer from '@components/AudioVisualizer.svelte';
	import { getTrackAnalysisFromSpotify } from '@utils/spotifyAPI.js';
	import { initializePlayer } from '@utils/spotifyPlayer.js';
	import { session } from '$app/stores';

	export let fetchedPlaylist;
	export let playlistId;
	export let playlistName;
	export let randomTerm;
	export let videos;

	// On runtime, fetchedPlaylist will be automatically populated from context="module" props
	$playlist = fetchedPlaylist;

	// update data inside store instead of reactive statement because we only want to this once
	searchTerm.set(randomTerm);
	videosData.set(videos);
	videoPlaylistLength.set(videos?.videos?.length ?? 0);

	$: {
		$trackAnalysis = getTrackAnalysis($currentTrack, playlistId);
	}

	$: {
		// Call this function once when we are in the record view, changes every time that we change the playlist id
		// If we are in a new playlist, reset currentTrack to index 0
		if ($previousPlaylistId !== playlistId) {
			$currentTrack = 0;
		}
		// If we are in the same playlist, currentTrack should be the same and we should play where we left off
		$previousPlaylistId = playlistId;
	}

	async function getTrackAnalysis(currentTrack, playlistId) {
		// browser checks what is the runtime environment so we only run it on the client side
		// fetch is polyfill
		if (browser) {
			let result;
			const trackId = $playlist?.track?.['items'][currentTrack]['track']['id'];

			// If the user is connected to Spotify
			if ($session['access_token']) {
				result = await getTrackAnalysisFromSpotify($session, trackId);
				console.log('*****SPOTIFY TRACK ANALYSIS*****', result);
				return result;
			}
			// If the user is loading app for the first time
			const url = `/json/audio-analysis/${playlistId}/${trackId}.json`;
			const res = await fetch(url);
			result = await res.json();
			console.log('*****LOCAL TRACK ANALYSIS****', result);
			return result;
		} else {
			return {};
		}
	}
	playlistName = getPlaylistProperty(playlistId);
</script>

<EventListener />
<Controls title={playlistName} />
<!-- <h1>
	{#each $playlist.items as trackObject}
		<p>{trackObject.track.name}</p>
	{/each}
</h1> -->
<AudioVisualizer />

<!-- GETTING VIDEO URLS
1. Set default search term to randomTerm from store
2. GET request to video API 
2.1 We have access to any variable inside the .env file when we prefix with VITE
2.2 We can't import process, so we use import.meta.env.
3. Update the variable videosData inside store with set()
3.1 videosData can be used in AudioVisualizer component afterwards
3.2 doing inside [id].svelte saves time to client (instead of using onMount where the user is making a request every time)
-->

<!-- GETTING PLAYLIST 
1. Fetched the entire playlist (module)
2. Assigned fetchedPlaylist to the playlist object on the store
3. With current playlist id + currentTrack index -> find the trackAnalysis + audio file stored locally
-->

<!-- SYNCHRONIZINGI SEARCHTERM
searchTerm cannot be accessed from context='module' because it's a writable
1. get randomTerm context="module"
2. pass it as a prop in load
3. client/browser runtime = update searchTerm with set()
4. searchTerm -> is now available everywhere 
-->
