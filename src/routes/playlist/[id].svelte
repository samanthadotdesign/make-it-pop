<script context="module">
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status }) {
		const url = `/json/playlists/${params.id}.json`;
		const res = await fetch(url);
		return {
			props: {
				fetchedPlaylist: await res.json() // res.json() returns a promise
			}
		};
	}
</script>

<script>
	import { playlist } from '@stores/userDataStore.js';
	import { page } from '$app/stores';

	import EventListener from '@components/Playlist/EventListener.svelte';

	export let fetchedPlaylist;
	// On runtime, fetchedPlaylist will be automatically populated from context="module" props
	$playlist = fetchedPlaylist;
</script>

<EventListener />
<h1>
	{#each $playlist.items as trackObject}
		<p>{trackObject.track.name}</p>
	{/each}
</h1>
