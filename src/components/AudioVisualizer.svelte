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
E.g song 0, video 0–5 -> song 1, video 3–6
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
	import {
		currentVideo,
		videosData,
		setVideoIndex,
		currentTrack,
		playStatus
	} from '@stores/visualizerStore.js';
	import { playlist } from '@stores/userDataStore.js';

	import { page } from '$app/stores';
	const { params } = $page;
	const { id: playlistId } = params;

	let video;
	let audio;
	let videoIsPlaying;

	$: currentTrackData = $playlist?.items?.[$currentTrack];
	$: currentVideoData = $videosData.videos[$currentVideo];

	// Triggers change in video when video ends automatically
	function videoEndedHandler(event) {
		setVideoIndex(true);
	}

	// Change player signal from play to pause
	function togglePlay() {
		if (!$playStatus) {
			audio.play();
		} else {
			audio.pause();
		}
		$playStatus = !$playStatus;
		console.log('*** PLAY STATUS', $playStatus);
	}

	// What to handle: change the song, but it stopped playing until i hit the play button
	console.log('play status on load', $playStatus);
</script>

{#if !$playStatus}
	<button
		id="startButton"
		class="w-24 h-24 rounded-full border-solid border-2 border-black"
		on:click={togglePlay}
		>Play
	</button>
{/if}

{#if $playStatus}
	<button
		id="pauseButton"
		class="w-24 h-24 rounded-full border-solid border-2 border-black"
		on:click={togglePlay}
		>Pause
	</button>
{/if}

<audio bind:this={audio} src={`/audio/${playlistId}/${currentTrackData?.track.id}.mp3`} />

<video
	bind:this={video}
	id="video"
	src={currentVideoData.video_files[0].link}
	crossOrigin="anonymous"
	playsinline
	muted={true}
	autoplay={true}
	class="w-full aspect-video"
	on:ended={videoEndedHandler}
/>
