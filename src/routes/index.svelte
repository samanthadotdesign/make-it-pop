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
