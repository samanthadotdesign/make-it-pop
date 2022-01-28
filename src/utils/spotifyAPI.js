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

import { writable, get, set } from 'svelte/store';
import {
	playlists /* all playlists */,
	playlist /* single playlist object with tract items */,
	trackAnalysis /* single track */
} from '@stores/userDataStore';

const CACHE = new Set();

/* Custom GET, POST, PUT functions to interface with Spotify */

// accessToken is from cookies, we check for these in index.svelte

/**
 * apiGet will fetch data from route
 * @param {str} route
 * @param {bool} cache
 * @param {str} dropRoot – url
 * @returns API response (json)
 */
export async function apiGet(route, cache = false, dropRoot = false) {
	try {
		if (cache && CACHE[route]) return CACHE[route];
		const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
		try {
			const { data } = await axios.get(dropRoot ? route : `${ROOT}/${route}`, { headers });
			if (cache) CACHE[route] = data;
			return data;
		} catch ({ response }) {
			if (response.status === 401) {
				// const token = await dispatch('refresh');
				return get(route, cache, { accessToken: token });
			}
		}
	} catch (e) {
		window.location.replace(`${PROJECT_ROOT}/api/authentication/login`); // eslint-disable-line
	}
}

async function apiPut(route, args, { accessToken, dispatch }) {
	const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
	try {
		const { data } = await axios.put(`${ROOT}/${route}`, args, { headers });
		return data;
	} catch ({ response }) {
		if (response.status === 401) {
			const token = await dispatch('refresh');
			return put(route, args, { accessToken: token, dispatch });
		}
	}
}

async function apiPost(route, args = {}, { accessToken, dispatch }, root = ROOT) {
	const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
	try {
		const { data } = await axios.post(`${root}/${route}`, args, { headers });
		return data;
	} catch ({ response }) {
		if (response.status === 401) {
			const token = await dispatch('refresh');
			return put(route, args, { accessToken: token, dispatch });
		}
	}
}
