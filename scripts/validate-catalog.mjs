import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'static');
const cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const floatOnId = '7tuJKZre2zfUdz0ERsqR1L';
const retiredIds = new Set(['ashes', 'point-of-no-return', '6nD4NgvMJbqRB6kraHxzDB']);
const audioExtensions = new Set([
	'.mp3',
	'.wav',
	'.ogg',
	'.m4a',
	'.aac',
	'.flac',
	'.opus',
	'.aif',
	'.aiff',
	'.webm'
]);

async function readJson(relativePath) {
	return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function nonempty(value, label) {
	assert.ok(typeof value === 'string' && value.trim().length > 0, `${label} must be nonempty`);
}

function checkLicense(license, label) {
	assert.equal(license?.url, cc0, `${label} must use the canonical CC0 URL`);
	assert.equal(license?.name, 'CC0 1.0', `${label} must identify CC0 1.0`);
}

function checkIds(actual, expected, label) {
	assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} must match the catalog IDs`);
}

async function sha256(file) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return hash.digest('hex');
}

async function publicAudioFiles(folder) {
	const files = [];
	for (const entry of await readdir(folder, { withFileTypes: true })) {
		const file = path.join(folder, entry.name);
		assert.ok(!entry.isSymbolicLink(), `Public audio must not contain symbolic links: ${file}`);
		if (entry.isDirectory()) files.push(...(await publicAudioFiles(file)));
		else if (audioExtensions.has(path.extname(entry.name).toLowerCase())) files.push(file);
	}
	return files;
}

async function validate() {
	const [catalog, audio, provenance] = await Promise.all([
		readJson('src/utils/recordCatalog.json'),
		readJson('src/utils/recordAudio.json'),
		readJson('static/json/cc0-record-sources.json')
	]);
	assert.ok(Array.isArray(catalog), 'recordCatalog.json must contain an array');
	assert.equal(catalog.length, 40, 'The public catalog must contain exactly 40 playlists');
	assert.ok(
		audio && typeof audio === 'object' && !Array.isArray(audio),
		'Audio map must be an object'
	);
	assert.ok(Array.isArray(provenance.releases), 'Provenance must contain a releases array');
	checkLicense(provenance.license, 'Provenance license');
	nonempty(provenance.checkedAt, 'Provenance checkedAt');

	const ids = catalog.map((record) => record.id);
	assert.equal(new Set(ids).size, catalog.length, 'Playlist IDs must be unique');
	const names = catalog.map((record) => {
		nonempty(record.name, `${record.id} name`);
		assert.equal(record.name, record.name.trim(), `${record.id} name has surrounding whitespace`);
		return record.name.normalize('NFC').toLowerCase();
	});
	assert.equal(new Set(names).size, catalog.length, 'Playlist names must be unique');
	assert.equal(
		catalog.filter((record) => record.name === 'Float On').length,
		1,
		'Keep Float On exactly once'
	);
	assert.equal(
		catalog.find((record) => record.id === floatOnId)?.name,
		'Float On',
		'Keep the Float On ID and name'
	);
	checkIds(Object.keys(audio), ids, 'Audio map');
	const releaseIds = provenance.releases.map((release) => release.id);
	assert.equal(
		new Set(releaseIds).size,
		releaseIds.length,
		'Provenance release IDs must be unique'
	);
	checkIds(releaseIds, ids, 'Provenance releases');
	const releases = new Map(provenance.releases.map((release) => [release.id, release]));
	const referenced = new Set();
	const hashes = new Map();
	const actualStaticRoot = await realpath(staticRoot);
	let tracks = 0;
	let seconds = 0;

	for (const record of catalog) {
		nonempty(record.id, 'Playlist ID');
		assert.ok(!retiredIds.has(record.id), `Non-CC0 legacy playlist must be retired: ${record.id}`);
		nonempty(record.artist, `${record.id} artist`);
		nonempty(record.originalTitle, `${record.id} originalTitle`);
		checkLicense(record.license, `${record.id} license`);
		assert.ok(
			Array.isArray(record.trackNames) && record.trackNames.length > 0,
			`${record.id} needs tracks`
		);
		const mapped = audio[record.id];
		assert.ok(
			mapped && typeof mapped === 'object' && !Array.isArray(mapped),
			`${record.id} audio map must be an object`
		);
		const numbered = record.trackNames.map((_, index) => String(index + 1));
		assert.deepEqual(
			Object.keys(mapped),
			numbered,
			`${record.id} audio map must have exactly ordered, consecutive track numbers`
		);
		const release = releases.get(record.id);
		for (const key of ['name', 'artist', 'originalTitle']) {
			assert.equal(
				release[key],
				record[key],
				`${record.id} provenance ${key} must match the catalog`
			);
		}
		if (release.license) checkLicense(release.license, `${record.id} provenance license`);
		assert.ok(Array.isArray(release.tracks), `${record.id} provenance must contain tracks`);
		assert.equal(
			release.tracks.length,
			record.trackNames.length,
			`${record.id} provenance track count must match`
		);

		for (const [index, title] of record.trackNames.entries()) {
			const label = `${record.id} track ${index + 1}`;
			nonempty(title, `${label} title`);
			const source = release.tracks[index];
			const src = mapped[index + 1];
			nonempty(src, `${label} audio path`);
			assert.ok(
				src.startsWith('/audio/') && !/[?#\\%]/.test(src),
				`${label} must reference a local public audio path`
			);
			assert.ok(
				!src.includes('//') && !src.split('/').some((part) => part === '.' || part === '..'),
				`${label} audio path must be canonical`
			);
			if (record.id === floatOnId) {
				assert.ok(
					src.startsWith('/audio/records/float-on/'),
					`${label} must use the new Float On audio folder`
				);
			}
			assert.equal(source.title, title, `${label} provenance title must match in order`);
			assert.equal(source.src, src, `${label} provenance audio path must match in order`);
			assert.ok(
				Number.isFinite(source.durationSeconds) && source.durationSeconds > 0,
				`${label} needs a positive duration`
			);
			assert.match(source.sha256 ?? '', /^[a-f0-9]{64}$/i, `${label} needs a SHA-256 checksum`);
			nonempty(source.source, `${label} original source`);
			if (source.license) checkLicense(source.license, `${label} license`);
			const file = path.join(staticRoot, src.slice(1));
			const actualFile = await realpath(file);
			assert.ok(
				actualFile.startsWith(`${actualStaticRoot}${path.sep}`),
				`${label} resolves outside public assets`
			);
			assert.ok((await stat(file)).isFile(), `${label} audio asset must be a file`);
			assert.ok(
				audioExtensions.has(path.extname(file).toLowerCase()),
				`${label} must reference an audio file`
			);
			if (!hashes.has(actualFile)) hashes.set(actualFile, await sha256(actualFile));
			assert.equal(
				hashes.get(actualFile),
				source.sha256.toLowerCase(),
				`${label} audio checksum mismatch`
			);
			referenced.add(file);
			tracks += 1;
			seconds += source.durationSeconds;
		}
	}

	const orphaned = (await publicAudioFiles(path.join(staticRoot, 'audio'))).filter(
		(file) => !referenced.has(file)
	);
	assert.equal(
		orphaned.length,
		0,
		`Unreferenced public audio remains: ${orphaned
			.map((file) => path.relative(root, file))
			.join(', ')}`
	);
	console.log(
		`Catalog valid: ${catalog.length} playlists, ${tracks} tracks, ${(seconds / 60).toFixed(
			1
		)} minutes, ${hashes.size} verified audio files.`
	);
}

validate().catch((error) => {
	console.error(`Catalog validation failed: ${error.message}`);
	process.exitCode = 1;
});
