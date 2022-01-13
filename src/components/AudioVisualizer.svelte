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
 -->
<script>
	import { currentVideo, videosData, setVideoIndex } from '@stores/visualizerStore.js';
	let video;

	$: currentVideoData = $videosData.videos[$currentVideo];

	// Triggers change in video when video ends automatically
	function videoEndedHandler(event) {
		setVideoIndex(true);
	}
</script>

<button id="startButton">Play</button>

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
