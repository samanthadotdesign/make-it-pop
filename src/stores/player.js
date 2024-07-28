import { writable, get, derived } from 'svelte/store';
import ease from '@mobilabs/easing';
import { interpolateNumber } from 'd3-interpolate';
import { scaleLinear } from 'd3-scale';
import { min, max, mean } from 'd3-array';
import cloneDeep from 'lodash/cloneDeep';
import { trackAnalysis } from '@stores/userDataStore.js';
export const intervalTypes = writable(['segments', 'tatums', 'beats', 'bars', 'sections']);

// VOLUME

// Settings for volume smoothing
export const volumeConfig = writable({
	volumeSmoothing: 30,
	volumeReference: 20,
	volumeReferenceMultiplier: 2
});

// Interpolating data from track analysis for visualizer
// 'player' prefix in the variable name refers to the object available in the DOM
export const playerActiveIntervals = writable({});
export const playerVolume = writable();
export const songVolume = writable({});
export const volumeQueues = writable({});

// INITIAL STATES
export const shuffleInterval = 'bars';
export const shuffleIntervalMultiplier = 2;
export const connected = false;
export const playStatus = writable(false);

/**
 * @param {*} progress track progress in milliseconds
 * @returns segment where the current progress of the song is
 */
async function getSegment(progress) {
	try {
		const _trackAnalysis = get(trackAnalysis);
		const analysis = _trackAnalysis.segments;
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

	const _trackAnalysis = get(trackAnalysis);
	const _volumeConfig = get(volumeConfig);

	// If it's the track analysis or the end of the track analysis
	if (!_trackAnalysis || !_trackAnalysis.segments[index + 1]) return 1;

	// Volume smoothing
	for (let i = -_volumeConfig.volumeSmoothing; i <= _volumeConfig.volumeSmoothing; i += 1) {
		const multiplier = parseFloat(_volumeConfig.volumeReferenceMultiplier);
		// Pushing more data points / segments into base array
		// Data points don't actually have any properties yet
		if (_trackAnalysis.segments[index + i * multiplier]) {
			base.push(_trackAnalysis.segments[index + i * multiplier].loudness_max);
			base.push(_trackAnalysis.segments[index + i * multiplier].loudness_start);
		}
	}

	// Populating the new data points that we just created with the correct data
	for (
		let i = -parseFloat(_volumeConfig.volumeSmoothing);
		i <= parseFloat(_volumeConfig.volumeSmoothing);
		i += 1
	) {
		const p = progress + i * _volumeConfig.volumeReferenceMultiplier;
		const index = await getSegment(p);
		const segment = _trackAnalysis.segments[index];
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
		const next = _trackAnalysis.segments?.[index + 1]?.loudness_start;
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
			const progress = ease.linear(__elapsed, 0, 1, __duration);
			const volume = interpolateNumber(loudness_max, next)(progress);
			values.push(volume);
		}
	}
	// returns ease value for the volume
	return scaleLinear([min(base) * 2, mean(base)], [0, 1])(mean(values));
}

// Constantly triggers this function and pass the track progress in milliseconds
function determineActiveIntervals(trackProgressMs) {
	const _intervalTypes = get(intervalTypes);

	const _trackAnalysis = get(trackAnalysis);
	if (!_trackAnalysis) return;
	const determineInterval = (type) => {
		const analysis = _trackAnalysis[type];
		for (let i = 0; i < analysis.length; i += 1) {
			// If it's the last interval, return itself
			if (i === analysis.length - 1) return i;
			if (analysis[i].start < trackProgressMs && trackProgressMs < analysis[i + 1].start) return i;
		}
	};

	const active = _intervalTypes.reduce((acc, type) => {
		const index = determineInterval(type);
		const interval = { ..._trackAnalysis[type][index], index };
		const { start, duration } = interval;
		const elapsed = trackProgressMs - start;
		interval.elapsed = elapsed;
		interval.progress = elapsed / duration;
		acc[type] = interval;
		return acc;
	}, {});
	playerActiveIntervals.set(active);
}

/**
 * Using time position relative to the song to sync
 */
export async function sync() {
	if (!window.$player) return;
	const _state = (await window?.$player?.getCurrentState()) || null;
	if (!_state) return;
	const { position } = _state;
	playerVolume.set(Math.pow(await _getVolume(position), 3));
	await determineActiveIntervals(position);
}

/**
 * Configs for queues[name] object
 */
export function registerVolumeQueue({ name, totalSamples, smoothing }) {
	const _volumeQueues = get(volumeQueues);
	const queues = cloneDeep(_volumeQueues);
	queues[name] = {
		values: [],
		volume: 0.5,
		average: 0.5,
		min: 0,
		max: 1,
		totalSamples,
		smoothing
	};
	volumeQueues.set(queues);
}

/**
 * Reset all the values of the queues properties to []
 */
export function resetVolumeQueues() {
	const _volumeQueues = get(volumeQueues);
	const queues = cloneDeep(_volumeQueues);
	for (let key in queues) {
		queues[key].values = [];
	}
	volumeQueues.set(queues);
}

export function getVolume() {
	const _playerActiveIntervals = get(playerActiveIntervals);
	const _trackAnalysis = get(trackAnalysis);
	// If no active intervals bc we haven't initialized the song yet, the volume is 1
	if (!_playerActiveIntervals) return 1;

	const { loudness_max, loudness_start, loudness_max_time, duration, elapsed, start, index } =
		cloneDeep(_playerActiveIntervals.segments);

	// The track analysis segments are over (index + 1 = if there is a next segment)
	// If there are no next segments, return 0.5 as the volume value
	if (!_trackAnalysis.segments || !_trackAnalysis.segments[index + 1]) return 0.5;

	const next = _trackAnalysis.segments?.[index + 1]?.loudness_start;
	const current = start + elapsed;
	const easing = 'linear';

	if (elapsed < loudness_max_time) {
		const progress = ease(Math.max(Math.min(1, elapsed / loudness_max_time), 0), easing);
		return interpolateNumber(loudness_start, loudness_max)(progress);
	} else {
		// The elapsed time is greater than or equal the loudness_max_time
		// reaches end of the segment
		// We still interpolate that last point, going to the next one and already know what it looks like
		const _start = start + loudness_max_time;
		const _elapsed = current - _start;
		const _duration = duration - loudness_max_time;
		const progress = ease(Math.max(Math.min(1, _elapsed / _duration), 0), easing);
		return interpolateNumber(loudness_max, next)(progress);
		// Interpolating the end of one segment & the beginning of the next one
	}
}

export async function processVolumeQueues() {
	// Get all the volumes. Make a deep clone if there are playerActiveIntervals
	const _volumeQueues = get(volumeQueues);
	const volume = await getVolume();
	const queues = cloneDeep(_volumeQueues);
	// For every single volume queue,
	for (let key in queues) {
		// queue[key].values = values of each property
		queues[key].values.unshift(volume);
		// Until values array length is equal to number of total samples, we're going to pop the last value
		while (queues[key].values.length > queues[key].totalSamples) queues[key].values.pop();
		queues[key].average = mean(queues[key].values);
		queues[key].min = min(queues[key].values);
		queues[key].max = max(queues[key].values);
		const sizeScale = scaleLinear([queues[key].min, queues[key].average], [0, 1]);
		// Get the last value of the values array
		const latest = mean(queues[key].values.slice(0, queues[key].smoothing));
		// Formatting the data to get the value to be between 0 to 1to get expected behaviour
		queues[key].volume = sizeScale(latest);
	}
	volumeQueues.set(queues);
}

/* TRACK ANALYSIS  */
// beatConfidence = x, loudnessAverage = y
export const loudnessAverage = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	return (
		($playerActiveIntervals?.segments?.loudness_start +
			$playerActiveIntervals?.segments?.loudness_max) /
		2
	);
});

export const beatConfidence = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	return $playerActiveIntervals?.beats?.confidence;
});

export const tempo = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	return $playerActiveIntervals?.sections?.tempo;
});

function getPercentage(startpos, endpos, currentpos) {
	var distance = endpos - startpos; // 100-(-100)
	var displacement = currentpos - startpos; // -43-(-100)
	return (displacement / distance) * 100;
}

// Range of timbre is from -100 to 100
// Getting percentage of the reference value * 255
export const red = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	const reference = $playerActiveIntervals?.segments?.timbre[1];
	const percentageFromValue = getPercentage(-300, 100, reference);
	return percentageFromValue;
});

export const blue = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	return (-$playerActiveIntervals?.segments?.timbre[2] / 3) * 255;
});

export const green = derived(playerActiveIntervals, ($playerActiveIntervals) => {
	return ($playerActiveIntervals?.segments?.timbre[3] / 3) * 255;
});
