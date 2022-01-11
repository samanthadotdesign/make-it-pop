<script>
	import { searchTerm } from '@stores/visualizerStore.js';
	let currentSearchTerm;

	$: {
		$searchTerm = currentSearchTerm;
	}

	function handleSearch() {
		currentSearchTerm = ''; // can reassign currentSearchTerm to empty so we empty the form field
	}
</script>

<input
	class="border-gray border-2 outline-none px-3 py-2 mr-1.5"
	type="text"
	placeholder="find a mood"
	bind:value={currentSearchTerm}
/>
<button class="border-black border-2 px-3 py-2" on:click={handleSearch}>Search</button>
