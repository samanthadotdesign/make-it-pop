import { get } from 'svelte/store';
import { currentTrack } from '@stores/visualizerStore.js';
import { playlist } from '@stores/userDataStore.js';
import { deviceSettings } from '@stores/spotify';
import { getAvailableDevices } from '@utils/spotifyAPI';
/**
 * Trigger initalized Spotify from [id].svelte
 * Connecting player instance after authentication
 */
export async function initializePlayer(access_token) {
	window.$player = new window.Spotify.Player({
		name: 'make it pop',
		getOAuthToken: (cb) => {
			cb(access_token);
		},
		volume: 0.5
	});

	// Check what is the active device and store it in the spotify store
	window.$player.addListener('ready', ({ device_id }) => {
		console.log('Ready with Device ID', device_id);
		deviceSettings.set({ ...get(deviceSettings), id: device_id });

		checkIfDeviceActive(access_token);
	});

	window.$player.addListener('not_ready', ({ device_id }) => {
		console.log('Device ID has gone offline', device_id);
	});

	// Get current track information from Spotify
	window.$player.addListener('player_state_changed', async (o) => {
		// Every time that player instance changes, we check if the device is active
		// We have access to this bool in deviceSettings['is_active]
		await checkIfDeviceActive(access_token);

		const currentTrackData = get(playlist)?.items?.[get(currentTrack)];

		const {
			/* position,
			duration, */
			paused,
			track_window: { /* next_tracks,  */ current_track }
		} = o;

		//console.log('CHECKING PLAYER STATE', position, duration, paused, next_tracks, current_track);
		if (!currentTrackData || currentTrackData.id !== current_track.id) {
			/* commit('SET_CURRENT_TRACK', current_track)
        commit('SET_ACTIVE_INTERVALS', null)
        await dispatch('fetchTrackAnalysis', current_track)
        dispatch('resetVolumeQueues') */
		}
		/* commit('SET_INITIAL_POSITION', position)
      commit('SET_TRACK_DURATION', duration)
      commit('SET_PAUSED', paused)
      commit('SET_NEXT_TRACKS', next_tracks) */
		if (paused) {
			/* commit('SET_ACTIVE_INTERVALS', null) */
		}
	});

	await window.$player.connect();
}

export function loadSpotifySDK() {
	let script = document.createElement('script');
	script.src = 'https://sdk.scdn.co/spotify-player.js';
	document.head.appendChild(script);
}

// If device is active, play the song
// Else, prompt user to pair to correct device in Spotify app
export async function checkIfDeviceActive(access_token) {
	const { devices } = await getAvailableDevices({ access_token });

	const { id } = get(deviceSettings);
	//console.log('CHECKING DEVICES', devices, id);
	const sdkStatus = devices.find((device) => {
		return device.id == id;
	});
	//console.log('CHECKING DEVICE', sdkStatus);
	const { is_active } = sdkStatus;
	deviceSettings.set({ ...get(deviceSettings), active: is_active });

	return is_active;
}
