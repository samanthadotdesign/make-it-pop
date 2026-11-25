<script context="module">
	import { recordAlbums } from '@utils/recordAlbums.js';

	export function load({ params }) {
		const album = recordAlbums.find(({ id }) => id === params.id);
		return album ? { props: { album } } : { status: 404, error: 'Album not found' };
	}
</script>

<script>
	import AlbumPlayer from '@components/Playlist/AlbumPlayer.svelte';

	export let album;
</script>

<svelte:head>
	<title>{album.name} · {album.artist}</title>
</svelte:head>

{#key album.id}
	<AlbumPlayer {album} />
{/key}
