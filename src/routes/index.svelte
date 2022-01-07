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
	<div>
		<button on:click={handleToggle} class="toggle">
			{#key view}
				<InlineSvg src={`/images/${view == 'record' ? 'list' : 'record'}.svg`} />
			{/key}
		</button>
	</div>

	<!-- Conditional rendering -->
	{#if view == 'record'}
		<RecordView />
	{:else}
		<ListView />
	{/if}
</div>

<style>
	.toggle {
		padding: 12px;
	}

	.toggle:hover {
		cursor: pointer;
	}
</style>
