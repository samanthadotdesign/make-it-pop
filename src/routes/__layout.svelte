<script>
	import '../styles/global-output.css';
	import Nav from '../components/Nav.svelte';
	import { deviceSettings } from '@stores/spotify';
	import { session } from '$app/stores';
	import { browser } from '$app/env';
	import { initializePlayer, loadSpotifySDK } from '@utils/spotifyPlayer.js';

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

{#if $session['access_token'] && !$deviceSettings['active']}
	<div class="fixed w-screen h-screen left-0 top-0 flex bg-black/50 items-center justify-center">
		<h1 class="text-white text-3xl text-center font-bold uppercase">
			choose the right device to continue
		</h1>
	</div>
{/if}

<Nav />
<slot />
