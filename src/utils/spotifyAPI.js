/**
 * 1. Create GET, POST, PUT custom functions that interfaces with Spotify
 * 2. Create functions in the store that use GET, POST, PUT to pull different kinds of data from the API
 * (i.e. playlist, track information, analysis)
 * 3. Trigger functions from corresponding components
 *    Rewrite playlists writable to use user's data instead
 * 4. Setup player instance (actual music player) and sync with current track (that already exist before login)
 *
 * modifying store values / asisgning new values to writables .update(), .get(), .set() because we're outside of a Svelte file
 */

import axios from 'axios';
import { get } from 'svelte/store';
import { deviceSettings } from '@stores/spotify';

const CACHE = new Set();
const ROOT = 'https://api.spotify.com/v1';
const PROJECT_ROOT = import.meta.env.VITE_PROJECT_ROOT;

export async function getUserPlaylists(session) {
	const { access_token } = session;
	const result = await apiGet({ route: 'me/playlists', accessToken: access_token });
	return result;
}

export async function getPlaylist(session, id) {
	const { access_token } = session;
	const result = await apiGet({ route: `playlists/${id}`, accessToken: access_token });
	return result;
}

export async function getTrackAnalysisFromSpotify(session, trackId) {
	const { access_token } = session;
	const result = await apiGet({ route: `audio-analysis/${trackId}`, accessToken: access_token });
	return result;
}

export async function getTrackFromSpotify(session, trackId) {
	const { access_token } = session;
	const result = await apiGet({ route: `track/${trackId}`, accessToken: access_token });
	return result;
}

// Get all available devices from the user to make sure that we are playing on the make it pop instance and it is active
export async function getAvailableDevices(session) {
	const { access_token } = session;
	const result = await apiGet({ route: `me/player/devices`, accessToken: access_token });
	return result;
}

/**
 * Play function forces Spotify player to play in the device ID
 */
export async function play(session, songs = null) {
	console.log('SESSION', session);
	const { access_token } = session;
	const { id } = get(deviceSettings);
	return await apiPut({
		route: `me/player/play?device_id=${id}`,
		args: songs,
		accessToken: access_token
	});
}

export async function pause(session) {
	const { access_token } = session;
	return apiPut({ route: 'me/player/pause', args: null, accessToken: access_token });
}

export async function next(session) {
	const { access_token } = session;
	return apiPost({ route: 'me/player/next', args: null, accessToken: access_token });
}

export async function previous(session) {
	const { access_token } = session;
	return apiPost({ route: 'me/player/previous', args: null, accessToken: access_token });
}

/**
 * When Spotify's tokens expire, we want to refresh and get new session data to get new tokens
 * @returns modified refreshed access_token
 */
async function refresh() {
	// We have access to client's session to find access_token, refresh_token
	const { access_token, refresh_token } = get(session);
	try {
		const { data } = await apiGet({
			route: `${PROJECT_ROOT}/api/authentication/refresh?token=${refresh_token}`,
			accessToken: access_token
		});
		session.set({ access_token: data.access_token, refresh_token: data.refresh_token });
		return data.access_token;
	} catch (e) {
		console.log(e);
	}
}

/* Custom GET, POST, PUT functions to interface with Spotify */

// accessToken is from cookies, we check for these in index.svelte and reference in our functions
// access_token is to declare new ones

/**
 * apiGet will fetch data from route
 * @param {str} route
 * @param {bool} cache
 * @param {str} dropRoot url
 * @returns API response (json)
 */
export async function apiGet({ route, cache = false, accessToken, dropRoot = false }) {
	try {
		if (cache && CACHE[route]) return CACHE[route];
		const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
		try {
			const { data } = await axios.get(dropRoot ? route : `${ROOT}/${route}`, { headers });
			if (cache) CACHE[route] = data;
			return data;
		} catch ({ response }) {
			if (response.status === 401) {
				const token = refresh();
				return apiGet({ route, cache, accessToken: token });
			}
		}
	} catch (e) {
		window.location.replace(`${PROJECT_ROOT}/api/authentication/login`);
	}
}

/**
 * apiPut will submit data to route
 * @param {object, str} args
 * @returns status
 */
export async function apiPut({ route, args, accessToken }) {
	const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
	try {
		const { data } = await axios.put(`${ROOT}/${route}`, args, { headers });
		return data;
	} catch ({ response }) {
		if (response.status === 401) {
			const token = refresh({ access_token: accessToken });
			return apiPut({ route, args, accessToken: token });
		}
	}
}

export async function apiPost({ route, args, accessToken, root = ROOT }) {
	const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
	try {
		const { data } = await axios.post(`${root}/${route}`, args, { headers });
		return data;
	} catch ({ response }) {
		if (response.status === 401) {
			const token = refresh({ access_token: accessToken });
			return apiPut({ route, args, accessToken: token });
		}
	}
}
