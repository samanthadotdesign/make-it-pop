<script>
	import '../styles/global-output.css';
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Nav from '../components/Nav.svelte';
	import ListeningRoom from '@components/Playlist/ListeningRoom.svelte';
	import { listeningSessionContext } from '@utils/listeningAudio.js';
	import { shelfRecords } from '@utils/shelfCatalog.js';

	const listening = writable(null);
	setContext(listeningSessionContext, listening);
	let roomRecord;

	$: pathname = $page.url.pathname.slice(base.length);
	$: deckRecord = pathname.startsWith('/listen/')
		? shelfRecords.find(({ id }) => id === $page.params.id)
		: undefined;
	$: {
		if (deckRecord) roomRecord = deckRecord;
		else if (pathname !== '/') {
			roomRecord = undefined;
			$listening = null;
		}
	}
	$: autoplay = !!deckRecord && $page.url.searchParams.get('play') === '1';
	$: returnToSession = !!deckRecord && $page.url.searchParams.get('return') === '1';
</script>

<Nav sessionRecord={$listening?.record} />
<slot />
{#if roomRecord}
	<div hidden={!deckRecord}>
		<ListeningRoom
			initialRecord={roomRecord}
			visible={!!deckRecord}
			{autoplay}
			{returnToSession}
			bind:nowPlaying={$listening}
		/>
	</div>
{/if}
