<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { login } from '@stores/spotify.js';
	import Searchbar from '@components/Searchbar.svelte';
	import InlineSvg from 'svelte-inline-svg';
	import ShelfIcon from '@components/Playlist/ShelfIcon.svelte';
	import { activeShelfRecord } from '@utils/shelfCatalog.js';

	$: pathname = $page.url.pathname.slice(base.length);
	$: isCustomizePage = pathname.endsWith('/customize');
	$: isAlbumPage = pathname.startsWith('/albums/');
	$: isPlaylistPage = isAlbumPage || (pathname.startsWith('/playlist') && !isCustomizePage);
	$: isHomePage = pathname === '/';
	$: isListening = pathname.startsWith('/listen/');
</script>

{#if !isCustomizePage}
	<nav class:legacy-player={isPlaylistPage}>
		<a href="{base}/">make it pop</a>
		<div class="actions">
			{#if !isHomePage && !isAlbumPage && !isListening}
				<button on:click={login}>connect</button>
			{/if}
			{#if isHomePage}
				<a class="icon-link" href="{base}{$activeShelfRecord.path}" aria-label="Open turntable">
					<ShelfIcon name="deck" />
				</a>
			{:else if isListening}
				<a class="icon-link" href="{base}/" aria-label="Back to the record shelf">
					<ShelfIcon name="return" />
				</a>
			{:else if isPlaylistPage}
				<a class="icon-link" href="{base}/" aria-label="Back to the record shelf">
					<InlineSvg src="{base}/images/record.svg" />
				</a>
			{:else}
				<Searchbar {isPlaylistPage} />
			{/if}
		</div>
	</nav>
{/if}

<style>
	nav {
		position: fixed;
		z-index: 3;
		inset: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 72px;
		padding-inline: 32px 22px;
		color: #151515;
		pointer-events: none;
	}

	nav > a,
	.actions {
		pointer-events: auto;
	}

	.legacy-player {
		color: white;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.icon-link {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
	}

	.icon-link:hover {
		background: #15151513;
	}
</style>
