<script>
	import { fetchVideos } from '@utils/videoAPI';
	import { searchTerm, videosData } from '@stores/visualizerStore.js';
	let currentSearchTerm;
	let open = false;
	export let isPlaylistPage = false;
	$: iconColor = isPlaylistPage ? 'white' : 'black';
	$: borderColor = isPlaylistPage ? 'white' : 'black';
	$: bgColor = isPlaylistPage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

	$: {
		$searchTerm = currentSearchTerm;
	}

	async function handleSearch() {
		$videosData = await fetchVideos(currentSearchTerm);
		currentSearchTerm = '';
		open = false;
	}
</script>

<div style="position: relative;">
	<button
		on:click={() => (open = !open)}
		style="width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 1px solid white; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	</button>

	{#if open}
		<div style="position: absolute; right: 0; top: 3rem; display: flex; gap: 0.5rem; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); padding: 0.5rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3);">
			<input
				style="border: none; outline: none; padding: 0.4rem 0.6rem; background: white; border-radius: 2px;"
				type="text"
				placeholder="find a mood"
				bind:value={currentSearchTerm}
				on:keydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button
				style="padding: 0.4rem 0.8rem; background: white; border: none; cursor: pointer; border-radius: 1px;"
				on:click={handleSearch}
			>Search</button>
		</div>
	{/if}
</div>
