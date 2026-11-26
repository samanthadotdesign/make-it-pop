import { writable } from 'svelte/store';
import { recordAlbums } from './recordAlbums.js';
import { vinylTreatments } from './vinylTreatments.js';
const floatOnId = '7tuJKZre2zfUdz0ERsqR1L';

const artwork = {
	[floatOnId]: 'float',
	'public-domain-lo-fi-2': 'galaxy',
	'to-chill-and-stay-awake': 'water',
	'after-dark': 'dusk'
};

const shelfTints = {
	float: '#7a77e8',
	galaxy: '#8f75b5',
	water: '#498bd4',
	dusk: '#e7927c'
};

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

export const shelfRecords = recordAlbums.map(recordOnShelf);

export const activeShelfRecord = writable(shelfRecords[0]);
