import { execFile } from 'node:child_process';
import { readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const site = 'build/pages';
const sizeLimit = 1_000_000_000;
const files = (await readdir(site, { recursive: true, withFileTypes: true }))
	.filter((entry) => entry.isFile())
	.map((entry) => join(entry.parentPath, entry.name));

async function siteSize() {
	const sizes = await Promise.all(files.map((file) => stat(file)));
	return sizes.reduce((total, { size }) => total + size, 0);
}

async function prepareTracks(tracks) {
	for (const source of tracks) {
		const output = `${source}.pages.mp3`;
		try {
			await run('ffmpeg', [
				'-nostdin',
				'-hide_banner',
				'-loglevel',
				'error',
				'-y',
				'-i',
				source,
				'-map',
				'0:a:0',
				'-c:a',
				'libmp3lame',
				'-b:a',
				'112k',
				output
			]);
			if ((await stat(output)).size < (await stat(source)).size) await rename(output, source);
		} finally {
			await rm(output, { force: true });
		}
	}
}

const originalSize = await siteSize();
if (originalSize > sizeLimit) {
	// Encode only the published copies. All tracks keep their existing URLs.
	const tracks = files.filter((file) => file.endsWith('.mp3')).values();
	await Promise.all(Array.from({ length: 4 }, () => prepareTracks(tracks)));
}

const finalSize = await siteSize();
if (finalSize > sizeLimit) {
	throw new Error(`GitHub Pages build is ${finalSize} bytes, above the ${sizeLimit}-byte limit.`);
}
console.log(`GitHub Pages build: ${finalSize} bytes (before audio preparation: ${originalSize}).`);
