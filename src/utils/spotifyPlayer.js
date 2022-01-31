/**
 * Trigger initalized Spotify from [id].svelte
 * Connecting player instance after authentication
 */
export async function initializePlayer(access_token) {
	window.$player = new window.Spotify.Player({
		name: 'make it pop',
		getOAuthToken: (cb) => {
			cb(access_token);
		}
	});

	await window.$player.connect();
	/* dispatch('attachListeners')
	commit('SET_INITIALIZED', true) */
}

export function loadSpotifySDK() {
	let script = document.createElement('script');
	script.src = 'https://sdk.scdn.co/spotify-player.js';
	document.head.appendChild(script);
}
