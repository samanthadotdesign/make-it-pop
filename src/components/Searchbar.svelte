<script>
	import { fetchVideos } from '@utils/videoAPI';
	import { searchTerm, videosData } from '@stores/visualizerStore.js';
	let currentSearchTerm;

	$: {
		$searchTerm = currentSearchTerm;
	}

	async function handleSearch() {
		$videosData = await fetchVideos(currentSearchTerm);
		console.log('*** VIDEOS ***', $videosData);
		currentSearchTerm = ''; // reassign currentSearchTerm to empty so we empty the form field
	}
</script>

<div class="flex justify-between">
	<input
		class="border-gray border-2 outline-none px-3 py-2 mr-1.5"
		type="text"
		placeholder="find a mood"
		bind:value={currentSearchTerm}
	/>
	<button class="border-black border-2 px-3 py-2" on:click={handleSearch}>Search</button>
</div>
