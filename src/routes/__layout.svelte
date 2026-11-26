<script>
	import '../styles/global-output.css';
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { base } from '$app/paths';
	import { page, session } from '$app/stores';
	import Nav from '../components/Nav.svelte';
	import ListeningRoom from '@components/Playlist/ListeningRoom.svelte';
	import { deviceSettings } from '@stores/spotify';
	import { browser } from '$app/env';
	import { listeningSessionContext } from '@utils/listeningAudio.js';
	import { shelfRecords } from '@utils/shelfCatalog.js';
	import { initializePlayer, loadSpotifySDK } from '@utils/spotifyPlayer.js';

	const listening = writable(null);
	setContext(listeningSessionContext, listening);
	let roomRecord;

	$: pathname = $page.url.pathname.slice(base.length);
	$: deckRecord = pathname.startsWith('/listen/')
		? shelfRecords.find(({ id }) => id === $page.params.id)
		: undefined;
	$: {
		if (deckRecord) roomRecord = deckRecord;
		else if (pathname !== '/') {
			roomRecord = undefined;
			$listening = null;
		}
	}
	$: autoplay = !!deckRecord && $page.url.searchParams.get('play') === '1';
	$: returnToSession = !!deckRecord && $page.url.searchParams.get('return') === '1';

	$: {
		const { access_token } = $session;
		// We check that the browser because we want the window object
		// onMount() -> will only trigger once on client load
		if (access_token && browser) {
			// We initialize Spotify on initial page load bc the loaded spotify-js file from app.html requires it

			if (!$deviceSettings['initialized']) {
				// 1. Define Spotify initialization. This is not calling the script's method
				window.onSpotifyWebPlaybackSDKReady = async () => {
					console.log('CHECKING SPOTIFY SDK READY');
					const { access_token } = $session;
					initializePlayer(access_token);
					$deviceSettings = { ...$deviceSettings, initialized: true };
				};
				// 2. Load SpotifySDK after we define Spotify initialization callback
				loadSpotifySDK();
			}
		}
	}
</script>

<!-- 
{#if $session['access_token'] && !$deviceSettings['active']}
	<div class="fixed w-screen h-screen left-0 top-0 flex bg-black/50 items-center justify-center">
		<h1 class="text-white text-3xl text-center font-bold uppercase">
			choose the right device to continue
		</h1>
	</div>
{/if} -->

<Nav sessionRecord={$listening?.record} />
<slot />
{#if roomRecord}
	<div hidden={!deckRecord}>
		<ListeningRoom
			initialRecord={roomRecord}
			visible={!!deckRecord}
			{autoplay}
			{returnToSession}
			bind:nowPlaying={$listening}
		/>
	</div>
{/if}
