<!-- 
Logic
0. starts with randomTerm 
1. Use searchTerm to fetch video API, return array
--------------------------------------------------
Interaction behaviour
0. Assign a new video to each video in array
1. Different videos for the entire length of the song
2. When the song changes, change the video
3. When we run out of videos, loop back to the beginning 
E.g song 0, video 0–5 -> song 1, videxo 3–6
--------------------------------------------------
Play audio (local files)
0. Fetch the actual track id from array & handle the prev/next
1. Fetch the mp3 file 
2. Play the file using browser API 
--------------------------------------------------
Play audio (Spotify link)
--------------------------------------------------
Play button => sync video + audio playing
0. Create a function to handle both video + audio 
Handling audio autoplaying in EventListener 
Handling video autoplaying in visualizerStore
trusted events 
1. Handle audio on end -> need to trigger track change
2. Store playStatus variable in the store, we use it also to manage auto-hide different components 
 -->
<script>
	import { tick, onMount } from 'svelte';

	import {
		currentVideo,
		videosData,
		setVideoIndex,
		currentTrack,
		setAudioIndex
	} from '@stores/visualizerStore.js';

	import Sketch from '@components/Sketch.svelte';

	import { playStatus } from '@stores/player.js';

	import { playlist } from '@stores/userDataStore.js';
	import { getTrackFromSpotify } from '@utils/spotifyAPI.js';

	import ThreeScene from '@utils/threeScene.svelte';
	import InlineSvg from 'svelte-inline-svg';
	import { cameraMode, cameraStream } from '@stores/cameraStore.js';

	let facingMode = 'user';
	let isMobile = false;

	onMount(() => {
		isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
	});

	async function flipCamera() {
		if (!$cameraMode) return;
		// Stop existing tracks
		const current = $cameraStream;
		if (current) current.getTracks().forEach(t => t.stop());

		facingMode = facingMode === 'user' ? 'environment' : 'user';
		try {
			const newStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode },
				audio: false
			});
			cameraStream.set(newStream);
			if (video) {
				video.srcObject = newStream;
				video.play().catch(() => {});
			}
		} catch (e) {
			console.log('flip camera error', e);
		}
	}

	import { page, session } from '$app/stores';
	const { params } = $page;
	const { id: playlistId } = params;

	let video;
	let audio;
	let videoIsPlaying;

	/* WATCH/COMPUTED */

	$: currentTrackData = $playlist?.tracks?.items?.[$currentTrack];
	$: currentVideoData = $videosData?.videos?.[$currentVideo];

	// On load, if the playStatus is true, keep playing the music
	// We keep track of the song with currentTrack, we declare it as a dependency using subscribe
	// This code will run every time currentTrack changes
	// tick forces the code block to wait until all state changes are resolved and applied to the DOM
	currentTrack.subscribe(async () => {
		if ($playStatus) {
			await tick();
			playMedia();
		}
	});

	// Every time playStatus changes, play or pauseMedia() will be triggered
	playStatus.subscribe(async () => {
		await tick();
		if ($playStatus) {
			playMedia();
		} else {
			pauseMedia();
		}
	});

	// Triggers change in audio when track ends automatically
	function audioEndedHandler(event) {
		setAudioIndex(true);
	}

	// Triggers change in video when video ends automatically
	function videoEndedHandler(event) {
		setVideoIndex(true);
	}

	function playMedia() {
		if (video) {
			video.play().catch(() => {});
		}

		// This will only run on offline mode.
		if (audio) {
			audio.play().catch(() => {});
		}
	}

	function pauseMedia() {
		if (video) {
			video.pause();
		}

		// This will only run on offline mode.
		if (audio) {
			audio.pause();
		}
	}

	// When camera mode activates, point the video element at the camera stream
	$: if (video && $cameraMode && $cameraStream) {
		video.srcObject = $cameraStream;
		video.play().catch(() => {});
	} else if (video && !$cameraMode) {
		video.srcObject = null;
	}
</script>

<!-- For offline mode -->
{#if !$session['access_token']}
	<!-- Not yet playing from Spotify API -->
	<audio
		bind:this={audio}
		src={`/audio/${playlistId}/${currentTrackData?.track.id}.mp3`}
		on:ended={audioEndedHandler}
	/>
{/if}

<video
	bind:this={video}
	id="video"
	src={$cameraMode ? undefined : currentVideoData?.video_files?.[0]?.link}
	crossOrigin="anonymous"
	playsinline
	muted={true}
	autoplay={$playStatus ? true : false}
	style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: 0; visibility: hidden;"
	on:ended={$cameraMode ? undefined : videoEndedHandler}
/>

<ThreeScene {video} />

{#if $cameraMode && isMobile}
	<button
		on:click={flipCamera}
		style="position: fixed; bottom: 2rem; left: 2rem; z-index: 3; background: none; border: none; cursor: pointer; padding: 0;"
	>
		<InlineSvg src="/images/reverse.svg" />
	</button>
{/if}
