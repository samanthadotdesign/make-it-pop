<!-- 
Logic
0. starts with randomTerm 
1. Use searchTerm to fetch video API, return array
--------------------------------------------------
Interaction behaviour
0. Assign a new video to each video in array
1. Different videos for the entire length of the song
2. When the song changes, change the video
E.g song 0, video 0–5 -> song 1, video 3–6
 -->
<script>
	import { currentVideo, videosData } from '@stores/visualizerStore.js';

	$: currentVideoData = $videosData.videos[$currentVideo];
</script>

<button id="startButton">Play</button>

<video
	id="video"
	src={currentVideoData.video_files[0].link}
	crossOrigin="anonymous"
	playsinline
	muted={true}
	autoplay={true}
	class="w-full aspect-video"
/>
