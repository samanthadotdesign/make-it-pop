<script context="module">
	// On page load, get the user's cookies on the server side, send to the store
	import { parse } from 'cookie';
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params, fetch, error, status, session }) {
		console.log('CHECKING SESSION', session);

		return {
			props: {}
		};
	}
</script>

<script>
	import RecordView from '../components/Playlist/RecordView.svelte';
	import ListView from '../components/Playlist/ListView.svelte';

	import InlineSvg from 'svelte-inline-svg';

	// Current view is RecordView
	let view = 'record';

	// Checks itself to reassign to 'list' or 'record'
	const handleToggle = () => {
		view = view == 'record' ? 'list' : 'record';
	};
</script>

<div class="flex flex-col">
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
