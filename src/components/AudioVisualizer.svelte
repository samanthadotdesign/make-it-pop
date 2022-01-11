<!-- 
Logic
1. Use searchTerm to fetch video API, return array
2. Assign a new video to each video in array
Interaction behaviour
1. Different videos for the entire length of the song
2. When the song changes, change the video
E.g song 0, video 0–5 -> song 1, video 3–6
 -->
<script context="module">
</script>

<script>
	import { searchTerm, videosData } from '@stores/visualizerStore.js';

	console.log('**** VIDEOS ***', $videosData);
</script>
