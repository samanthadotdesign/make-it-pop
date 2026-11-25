<script context="module">
	import { getUserPlaylists } from '@utils/spotifyAPI.js';

	export async function load({ session }) {
		const initialPlaylists = session.access_token ? await getUserPlaylists(session) : null;
		return { props: { initialPlaylists } };
	}
</script>

<script>
	import { onMount } from 'svelte';
	import RecordView from '@components/Playlist/RecordView.svelte';
	import { playlists } from '@stores/userDataStore';
	import { recordOnShelf, shelfRecords } from '@utils/shelfCatalog.js';

	export let initialPlaylists;

	const curatedIds = new Set(shelfRecords.map(({ id }) => id));
	$: shelf = [
		...shelfRecords,
		...($playlists?.items ?? []).filter(({ id }) => !curatedIds.has(id)).map(recordOnShelf)
	];

	onMount(() => {
		if (initialPlaylists) $playlists = initialPlaylists;
	});
</script>

<svelte:head>
	<title>make it pop</title>
</svelte:head>

<main>
	<RecordView items={shelf} />
</main>
