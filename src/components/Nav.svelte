<script>
	import { login } from '@stores/spotify.js';
	import Searchbar from '@components/Searchbar.svelte';
	import InlineSvg from 'svelte-inline-svg';
	import { page } from '$app/stores';
	import { navView } from '@stores/layoutStore';

	$: isPlaylistPage = $page.url.pathname.startsWith('/playlist');
	$: isHomePage = $page.url.pathname === '/';

	const handleToggle = () => {
		navView.update(v => v === 'record' ? 'list' : 'record');
	};
</script>

<nav class="flex justify-between items-center px-8 py-6" style="position: fixed; top: 0; left: 0; right: 0; z-index: 3; color: {isPlaylistPage ? 'white' : 'black'};">
	<a class="inline-block" href="/">ambient visual</a>
	<div class="inline-block flex items-center gap-4">
		<button on:click={login}>connect</button>
		{#if isHomePage}
			<button on:click={handleToggle} class="cursor-pointer">
				{#key $navView}
					<InlineSvg src={`/images/${$navView === 'record' ? 'list' : 'record'}.svg`} />
				{/key}
			</button>
		{:else}
			<Searchbar {isPlaylistPage} />
		{/if}
	</div>
</nav>
