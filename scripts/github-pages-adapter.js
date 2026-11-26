import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export default function githubPages() {
	return {
		name: 'github-pages',
		async adapt(builder) {
			const destination = 'build/pages';
			builder.rimraf(destination);
			builder.writeStatic(destination);
			builder.writeClient(destination);

			// Serve the same client router for the shelf and direct links to a record.
			await builder.prerender({ dest: destination, fallback: 'index.html' });
			const index = join(destination, 'index.html');
			if (!(await stat(index)).size) throw new Error('GitHub Pages generated an empty entry page.');
			await copyFile(index, join(destination, '404.html'));

			const albumAudio = JSON.parse(await readFile('src/utils/recordAudio.json', 'utf8'));
			const playlists = JSON.parse(await readFile('static/json/playlists.json', 'utf8'));
			const recordIds = new Set([
				...Object.keys(albumAudio),
				...playlists.items.map(({ id }) => id)
			]);
			for (const id of recordIds) {
				const directory = join(destination, 'listen', encodeURIComponent(id));
				await mkdir(directory, { recursive: true });
				await copyFile(index, join(directory, 'index.html'));
			}
		}
	};
}
