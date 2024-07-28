<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { interpolate } from 'd3-interpolate';
	import { buildUniforms, getTweenableChanges, getBooleanChanges } from '@utils/uniforms';
	import cloneDeep from 'lodash/cloneDeep';
	import {
		shuffleInterval,
		shuffleIntervalMultiplier,
		playerVolume,
		playerActiveIntervals,
		loudnessAverage,
		beatConfidence,
		red,
		green,
		blue,
		playStatus,
		tempo,
		sync
	} from '@stores/player.js';
	import { tweenDuration, tick } from '@stores/visualizerStore.js';

	import AudioAnalysisTexture from '@utils/audioAnalysisTexture.js';

	let _stop = null;
	let intervalIndex = 0;

	$: activeIntervals = $playerActiveIntervals;
	$: volume = $playerVolume;

	$: {
		// Changing the tween duration depending on activeIntervals['bars'] which creates dynamic behaviour on the visualization
		if (activeIntervals) {
			const interval = activeIntervals[shuffleInterval];
			if (interval || (interval && intervalIndex !== interval.index)) {
				intervalIndex = interval.index;
				if (intervalIndex % shuffleIntervalMultiplier == 0) {
					tweenDuration.set(interval.duration * shuffleIntervalMultiplier * 0.9);
				}
			}
		}
	}

	// Run loop when variables change, tick is the signal to request refresh
	$: {
		setInterval(() => {
			if ($playStatus) {
				$tick = Date.now();
				sync();
			}
		}, 25);
	}

	// Setting x and y coordinates using trackAnalysis store data
	// beatConfidence = 0 to 1
	// loudness = -60 to 0
	let audioAnalysisTexture;

	$: {
		if (audioAnalysisTexture) {
			// if audio analysis texture exists, then add a point using the normalized value
			if ($loudnessAverage && $beatConfidence) {
				/* ----- PLAY AROUND WITH NORMALIZING THE VALUES FOR X, Y POINTS ---- */
				const x = $beatConfidence * 100;
				const y = ($loudnessAverage * 100) / -60;

				const point = { x, y, red: $red, green: $green, blue: $blue };
				console.log('playerActiveIntervals', $playerActiveIntervals);
				audioAnalysisTexture.addPoint(point);
				/* ----- ADD THE COLOUR MAP IN (255, 255, 255) HERE ----- */
			}
		}
	}

	onMount(() => {
		audioAnalysisTexture = new AudioAnalysisTexture({ debug: true });

		// function onMouseMovement(event) {
		// 	const point = {
		// 		x: event?.clientX / window.innerWidth,
		// 		y: event?.clientY / window.innerHeight
		// 	};

		// 	audioAnalysisTexture.addPoint(point);
		// }

		function canvasTick() {
			audioAnalysisTexture.update();
			requestAnimationFrame(canvasTick);
		}

		// window.addEventListener('pointermove', (event) => {
		// 	onMouseMovement(event);
		// });

		canvasTick();
	});
</script>
