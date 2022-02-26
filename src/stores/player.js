import { writable } from 'svelte/store';
import ease from '@mobilabs/easing';
import interpolateNumber from 'd3-interpolate';
import scaleLinear from 'd3-scale';
import {
	trackAnalysis,
	volumeConfig,
	playerActiveIntervals,
	playerVolume
} from '@stores/userDataStore.js';

export const intervalTypes = writable(['segments', 'tatums', 'beats', 'bars', 'sections']);

/**
 * @param {*} progress track progress in milliseconds
 * @returns segment where the current progress of the song is
 */
async function getSegment(progress) {
	try {
		const analysis = trackAnalysis.segments;
		console.log('get segment - track analysis here', analysis);
		for (let i = 0; i < analysis.length; i += 1) {
			if (i === analysis.length - 1) return i;
			if (analysis[i].start < progress && progress < analysis[i + 1].start) return i;
		}
	} catch {
		return -1;
	}
}

/**
 * Use time position relative to the song to determine the active intervals
 * @param {*} trackProgressMs
 * @returns
 */
async function _getVolume(trackProgressMs) {
	const progress = trackProgressMs;
	const base = [];
	const values = [];
	const index = await getSegment(progress);

	// If it's the track analysis or the end of the track analysis
	if (!trackAnalysis || !trackAnalysis.segments[index + 1]) return 1;

	// Volume smoothing
	for (let i = -volumeConfig.volumeSmoothing; i <= volumeConfig.volumeSmoothing; i += 1) {
		const multiplier = parseFloat(volumeConfig.volumeReferenceMultiplier);
		// Pushing more data points / segments into base array
		// Data points don't actually have any properties yet
		if (trackAnalysis.segments[index + i * multiplier]) {
			base.push(trackAnalysis.segments[index + i * multiplier].loudness_max);
			base.push(trackAnalysis.segments[index + i * multiplier].loudness_start);
		}
	}

	// Populating the new data points that we just created with the correct data
	for (
		let i = -parseFloat(volumeConfig.volumeSmoothing);
		i <= parseFloat(volumeConfig.volumeSmoothing);
		i += 1
	) {
		const p = progress + i * volumeConfig.volumeReferenceMultiplier;
		const index = await getSegment(p);
		const segment = trackAnalysis.segments[index];
		const { start, duration } = segment;
		const elapsed = p - start;
		segment.elapsed = elapsed;
		segment.progress = elapsed / duration;
		const {
			loudness_max,
			loudness_start,
			loudness_max_time,
			duration: _duration,
			elapsed: _elapsed,
			start: _start
		} = segment;
		const next = trackAnalysis.segments?.[index + 1]?.loudness_start;
		const current = start + elapsed;
		if (_elapsed < loudness_max_time) {
			// ease.linear(current time, beginning value, change in value, duration)
			const progress = ease.linear(_elapsed, 0, 1, loudness_max_time);
			const volume = interpolateNumber(loudness_start, loudness_max)(progress);
			values.push(volume);
		} else {
			const __start = _start + loudness_max_time;
			const __elapsed = current - __start;
			const __duration = _duration - loudness_max_time;
			const progress = ease.linear(_elapsed, 0, 1, loudness_max_time);
			const volume = interpolateNumber(loudness_max, next)(progress);
			values.push(volume);
		}
	}
	// returns ease value for the volume
	return scaleLinear([min(base) * 2, mean(base)], [0, 1])(mean(values));
}

// Constantly triggers this function and pass the track progress in milliseconds
function determineActiveIntervals(trackProgressMs) {
	if (!trackAnalysis) return;
	const determineInterval = (type) => {
		const analysis = trackAnalysis[type];
		for (let i = 0; i < analysis.length; i += 1) {
			// If it's the last interval, return itself
			if (i === analysis.length - 1) return i;
			if (analysis[i].start < trackProgressMs && trackProgressMs < analysis[i + 1].start) return i;
		}
	};

	const active = intervalTypes.reduce((acc, type) => {
		const index = determineInterval(type);
		const interval = { ...trackAnalysis[type][index], index };
		const { start, duration } = interval;
		const elapsed = trackProgressMs - start;
		interval.elapsed = elapsed;
		interval.progress = elapsed / duration;
		acc[type] = interval;
		return acc;
	}, {});

	/* 
    CURRENTLY ACTIVE 
    active: {
      beats: {
        start: dec,
        duration: time in ms,
        index: 1,
        elapsed: time in ms,
        progres: perrcentage 0 -100%,
        beatValue?: 
      },
      bars: {
        start: dec,
        duration: time in ms,
        index: 1,
        elapsed: time in ms,
        progres: perrcentage 0 -100%,
      },
    }
    */
	playerActiveIntervals.set(active);
}

// Using time position relative to the song to sync
export async function sync() {
	if (!window.$player) return;
	const _state = (await window?.$player?.getCurrentState()) || null;
	if (!_state) return;
	const { position } = _state;
	playerVolume.set(Math.pow(await _getVolume(position), 3));
	await determineActiveIntervals(position);
}
