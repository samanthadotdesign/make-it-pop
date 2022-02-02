<!-- 
Functional component that won't be rendering visually 
But isolates the logic that listens to the body event
1. Register touch / pointer event from browser (mobile/desktop) 
2. Threshold for to trigger: delta position for touch/pointer
3. Fetch current playlist, counter for track state, go to next index 
-->
<script>
	import { onMount } from 'svelte';
	import { windowObject } from '@stores/layoutStore.js';
	import {
		currentTrack,
		currentVideo,
		setVideoIndex,
		setAudioIndex
	} from '@stores/visualizerStore.js';
	import { playlist } from '@stores/userDataStore.js';

	import { previous, next } from '@utils/spotifyAPI';
	import { session } from '$app/stores';

	// Local state to listen for pointer down during swipe or scroll (down or not)
	let height;
	let width;

	// When dependencies, height & width change, they will be reassigned to the $windowObject.height & width
	$: {
		$windowObject.height = height;
		$windowObject.width = width;
	}

	// When the user is scrolling on desktop
	// Debounce -> execute a command a certain number of times so that we don't break by scrolling too quickly
	function handleScroll(event) {
		if (Math.sign(event.deltaY) == -1) {
			next($session);
			setAudioIndex(true);
		} else if (Math.sign(event.deltaY) == 1) {
			previous($session);
			setAudioIndex(false);
		}
	}

	// Waiting to be mounted on the client to get document body and window element that Hammer needs
	// Hammer handles swipes for mobile and click+drag for desktop
	onMount(() => {
		// REFERENCING BODY
		const body = document.body;

		// CREATING A NEW HAMMER INSTANCE
		var hammertime = new Hammer(body);

		// BINDING SWIPE EVENT TO THE HAMMER TIME INSTANCE
		hammertime.get('swipe').set({ direction: Hammer.DIRECTION_ALL });

		// DEFINING FUNCTION TRIGGERS DEPENDING ON THE SWIPE DIRECTION
		hammertime.on('swipe', (e) => {
			let direction = '';

			switch (true) {
				case e.angle < -157.5 || e.angle > 157.5:
					direction = 'left';
					break;
				case e.angle > -22.5 && e.angle < 22.5:
					direction = 'right';
					break;
				case e.angle < -67.5 && e.angle > -112.5:
					direction = 'up';
					break;
				case e.angle > 67.5 && e.angle < 112.5:
					direction = 'down';
					break;
				case e.angle < -112.5 && e.angle > -157.5:
					direction = 'left-up';
					break;
				case e.angle > 112.5 && e.angle < 157.5:
					direction = 'left-down';
					break;
				case -22.5 > e.angle && e.angle > -67.5:
					direction = 'right-up';
					break;
				case e.angle > 22.5 && e.angle < 67.5:
					direction = 'right-down';
					break;
				default:
					direction = 'unknown';
			}

			// WE USE HAMMER TO HELP US CHANGE THE TRACK COUNTER
			// If user is swiping left/up, they are looking for the next track & vice versa
			if (['left', 'left-down', 'left-up', 'up'].includes(direction)) {
				next($session);
				setAudioIndex(true);
			} else if (['right', 'right-down', 'right-up', 'down'].includes(direction)) {
				previous($session);
				setAudioIndex(false);
			}
		});

		// Prevent native function when pointer moves
		document.body.addEventListener('touchmove', function (event) {
			event.preventDefault();
		});
	});
</script>

<svelte:window on:mousewheel={handleScroll} bind:innerHeight={height} bind:innerWidth={width} />
