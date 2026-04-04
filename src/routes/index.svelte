<script context="module">
	import { getUserPlaylists, getMe } from '@utils/spotifyAPI.js';

	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status, session }) {
		const { access_token } = session;
		let initialPlaylists = null;
		let spotifyUser = null;
		if (access_token) {
			console.log('spotify auth found, fetching user data...');
			[initialPlaylists, spotifyUser] = await Promise.all([
				getUserPlaylists(session),
				getMe(session)
			]);
			console.log('spotify user:', spotifyUser);
		} else {
			console.log('no spotify auth token found');
		}
		return {
			props: {
				initialPlaylists,
				spotifyUser
			}
		};
	}
</script>

<script>
	import { onMount } from 'svelte';
	import RecordView from '../components/Playlist/RecordView.svelte';
	import ListView from '../components/Playlist/ListView.svelte';
	import InlineSvg from 'svelte-inline-svg';
	import { playlists } from '@stores/userDataStore';
	import { session } from '$app/stores';
	export let initialPlaylists;
	export let spotifyUser;

	let view = 'record';

	const handleToggle = () => {
		view = view == 'record' ? 'list' : 'record';
	};

	onMount(() => {
		if (initialPlaylists) {
			$playlists = initialPlaylists;
			console.log('spotify is connected', spotifyUser?.display_name);
			console.log(`${initialPlaylists.total} playlists returned`);
		}
	});
</script>

<div class="flex flex-col">
	{#if spotifyUser}
		<p class="px-8 pt-4 text-sm opacity-60">Connected as {spotifyUser.display_name}</p>
	{/if}

	{#if initialPlaylists}
		<p class="px-8 text-sm opacity-60">{initialPlaylists.total} playlists loaded</p>
	{/if}

	<!-- Button -->
	<button on:click={handleToggle} class="ml-auto mr-6 p-6 cursor-pointer">
		{#key view}
			<InlineSvg src={`/images/${view == 'record' ? 'list' : 'record'}.svg`} />
		{/key}
	</button>

	<!-- Conditional rendering -->
	{#if view == 'record'}
		<RecordView />
	{:else}
		<ListView />
	{/if}
</div>
