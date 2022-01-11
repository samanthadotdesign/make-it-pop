<script>
	import { searchTerm } from '@stores/visualizerStore.js';

	let currentSearchTerm;

	$: {
		$searchTerm = currentSearchTerm;
	}

	function handleSearch() {
		console.log('yay search', $searchTerm);
		currentSearchTerm = ''; // can reassign currentSearchTerm to empty so we empty the form field
	}
</script>

<form action="/" on:submit|preventDefault={handleSearch}>
	<input
		class="px-3 py-2 mr-1.5"
		type="text"
		placeholder="find a mood"
		bind:value={currentSearchTerm}
	/>
	<button class="px-3 py-2" type="submit">Search</button>
</form>
