<script>
	import { onMount } from 'svelte';
	import { interpolate } from 'd3-interpolate';
	import { buildUniforms, getTweenableChanges, getBooleanChanges } from '@utils/uniforms';
	import cloneDeep from 'lodash/cloneDeep';
	import {
		shuffleInterval,
		shuffleIntervalMultiplier,
		playerVolume,
		playerActiveIntervals,
		playStatus,
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

	onMount(() => {
		const audioAnalysisTexture = new AudioAnalysisTexture({ debug: true });

		function onMouseMovement(event) {
			const point = {
				x: event?.clientX / window.innerWidth,
				y: event?.clientY / window.innerHeight
			};

			audioAnalysisTexture.addPoint(point);
		}

		function canvasTick() {
			audioAnalysisTexture.update();
			requestAnimationFrame(canvasTick);
		}

		window.addEventListener('pointermove', (event) => {
			onMouseMovement(event);
		});

		canvasTick();
	});
</script>

<h3>
	{JSON.stringify(activeIntervals)}
</h3>
