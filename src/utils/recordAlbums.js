import catalog from './recordCatalog.json';
import audioFiles from './recordAudio.json';

export const recordAlbums = catalog.map(({ trackNames, ...album }) => ({
	...album,
	path: `/albums/${album.id}`,
	tracks: trackNames.map((title, index) => ({
		title,
		src: audioFiles[album.id][index + 1]
	}))
}));
