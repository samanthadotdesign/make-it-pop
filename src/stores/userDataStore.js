// Get user's initial playlist to show on homepage
// 1. Create playlist data variables that can be accessed from other components (RecordView, ListView)
// 2. Assign imported sample data to the variables as initial data
// json files are parsed on import

import { writable, get } from 'svelte/store';

// Playlist JSON from local files
import initialPlaylists from '../../static/json/playlists.json';
export const playlists = writable(initialPlaylists);

// Single playlist object (with track items)
export const playlist = writable({});

// JSON data for single track analysis
export const trackAnalysis = writable({});

// Fallback is the playlist name
// If we don't add getPlaylistPropert(0, "name"), then
export function getPlaylistProperty(playlistId, property = 'name') {
	const scopedPlaylists = get(playlists);
	const playlistsArray = scopedPlaylists.items;
	const currentPlaylist = playlistsArray.find((playlist) => playlist.id == playlistId);
	return currentPlaylist[property];
}
