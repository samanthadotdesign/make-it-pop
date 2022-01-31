<script>
	import Searchbar from '@components/Searchbar.svelte';
	export let title;
	import { playStatus, setAudioIndex } from '@stores/visualizerStore.js';
	import { play } from '@utils/spotifyAPI';
	import { session } from '$app/stores';

	// Change player signal from play to pause
	function togglePlay() {
		$playStatus = !$playStatus;
		if ($playStatus) {
			console.log('CHECKING PLAY FUNCTION', play);
			play($session);
		}
	}
</script>

<div class="flex justify-between items-center px-8 py-6 ">
	<h1>{title}</h1>
	<Searchbar />
</div>

<button
	id="startButton"
	class="w-24 h-24 rounded-full border-solid border-2 border-black"
	on:click={togglePlay}
>
	{#if !$playStatus}
		PLAY
	{:else}
		PAUSE
	{/if}
</button>

<div class="fixed bottom-0 left-0 right-0 flex justify-between items-center p-6">
	<button id="prevButton" on:click={() => setAudioIndex(false)}> prev </button>
	<button id="nextButton" on:click={() => setAudioIndex(true)}> next </button>
</div>
