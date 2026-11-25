import { writable } from 'svelte/store';
import { recordAlbums } from './recordAlbums.js';
import { vinylTreatments } from './vinylTreatments.js';
import playlists from '../../static/json/playlists.json';
import floatOnTracks from '../../static/json/playlists/7tuJKZre2zfUdz0ERsqR1L.json';
import notBoringTracks from '../../static/json/playlists/6nD4NgvMJbqRB6kraHxzDB.json';

const floatOnId = '7tuJKZre2zfUdz0ERsqR1L';
const notBoringId = '6nD4NgvMJbqRB6kraHxzDB';

const artwork = {
	[floatOnId]: 'float',
	'public-domain-lo-fi-2': 'galaxy',
	'to-chill-and-stay-awake': 'water',
	[notBoringId]: 'dusk'
};

const shelfTints = {
	float: '#7a77e8',
	galaxy: '#8f75b5',
	water: '#498bd4',
	dusk: '#e7927c'
};

function localPlaylist(id, tracks, color) {
	const playlist = playlists.items.find((item) => item.id === id);
	return {
		id: playlist.id,
		name: playlist.name,
		color,
		source: playlist.external_urls?.spotify,
		tracks: tracks.items.map(({ track }) => ({
			title: track.name,
			artist: track.artists?.map(({ name }) => name).join(', '),
			src: `/audio/${playlist.id}/${track.id}.mp3`
		}))
	};
}

export function recordOnShelf(record) {
	const finish = artwork[record.id];
	const treatment = vinylTreatments[finish];
	return {
		...record,
		finish,
		treatment,
		tint: shelfTints[finish] ?? record.color ?? '#a49bab',
		path: Array.isArray(record.tracks) ? `/listen/${record.id}` : `/playlist/${record.id}`
	};
}

const catalog = [
	localPlaylist(floatOnId, floatOnTracks.tracks, '#8178ff'),
	...recordAlbums,
	localPlaylist(notBoringId, notBoringTracks.tracks, '#8a8e9b')
];
const referenceOrder = Object.keys(artwork);

export const shelfRecords = [
	...referenceOrder.map((id) => catalog.find((record) => record.id === id)),
	...catalog.filter(({ id }) => !artwork[id])
].map(recordOnShelf);

export const activeShelfRecord = writable(shelfRecords[0]);
