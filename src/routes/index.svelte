<script context="module">
	// On page load, get the user's cookies on the server side, send to the store
	import { parse } from 'cookie';
	import { getUserPlaylists } from '@utils/spotifyAPI.js';

	// load is the lifecycle where session data can be checked
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status, session }) {
		const { access_token } = session;
		let initialPlaylists = null;
		if (access_token) {
			initialPlaylists = await getUserPlaylists(session);
		}
		return {
			props: {
				initialPlaylists
			}
		};
	}
</script>

<script>
	import { onMount } from 'svelte';
	import RecordView from '../components/Playlist/RecordView.svelte';
	import ListView from '../components/Playlist/ListView.svelte';
	import InlineSvg from 'svelte-inline-svg';
	import { playlists } from '@stores/userDataStore';
	import { session } from '$app/stores';
	export let initialPlaylists;
	import { initializePlayer, loadSpotifySDK } from '@utils/spotifyPlayer.js';

	// Current view is RecordView
	let view = 'record';

	// Checks itself to reassign to 'list' or 'record'
	const handleToggle = () => {
		view = view == 'record' ? 'list' : 'record';
	};
	// Updating the playlists store to user's Spotify playlist if it exists, onMount allows it to run only once
	onMount(() => {
		if (initialPlaylists) $playlists = initialPlaylists;
		// We initialize Spotify on initial page load bc the loaded spotify-js file from app.html requires it

		// 1. Define Spotify initialization. This is not calling the script's method
		window.onSpotifyWebPlaybackSDKReady = async () => {
			console.log('CHECKING SPOTIFY SDK READY');
			const { access_token } = $session;
			initializePlayer(access_token);
		};
		// 2. Load SpotifySDK after we define Spotify initialization callback
		loadSpotifySDK();
	});
</script>

<div class="flex flex-col">
	<!-- Button -->
	<button on:click={handleToggle} class="ml-auto mr-6 p-6 cursor-pointer">
		{#key view}
			<InlineSvg src={`/images/${view == 'record' ? 'list' : 'record'}.svg`} />
		{/key}
	</button>

	<!-- Conditional rendering -->
	{#if view == 'record'}
		<RecordView />
	{:else}
		<ListView />
	{/if}
</div>
