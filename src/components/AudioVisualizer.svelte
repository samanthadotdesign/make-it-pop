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
 -->
<script>
	import {
		currentVideo,
		videosData,
		setVideoIndex,
		currentTrack
	} from '@stores/visualizerStore.js';
	import { playlist } from '@stores/userDataStore.js';

	import { page } from '$app/stores';
	const { params } = $page;
	const { id: playlistId } = params;

	let video;
	let audio;

	$: currentTrackData = $playlist?.items?.[$currentTrack];

	$: currentVideoData = $videosData.videos[$currentVideo];

	// Triggers change in video when video ends automatically
	function videoEndedHandler(event) {
		setVideoIndex(true);
	}

	function handlePlay() {
		audio.play();
	}
</script>

<button id="startButton" on:click={handlePlay}>Play</button>

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
