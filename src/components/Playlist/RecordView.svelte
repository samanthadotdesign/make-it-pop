<!-- Added the colours bg-[#] to tailwind.config.cjs to make sure that they won't be purged during runtime -->
<script>
	import { playlists } from '@stores/userDataStore.js';
	import { colors } from '@stores/layoutStore.js';
</script>

<div class="w-full px-12">
	{#each $playlists.items as playlist, index}
		<a sveltekit:prefetch href={`/playlist/${playlist.id}`}>
			<div
				class={`bg-[${colors[index]}] rounded-full w-full aspect-square flex-row justify-center items-center`}
			>
				<div class="`bg-white rounded-full h-20 w-20" />
			</div>
		</a>
	{/each}
</div>
