<!-- Added the colours bg-[#] to tailwind.config.cjs to make sure that they won't be purged during runtime -->
<script>
	import { playlists } from '@stores/userDataStore.js';
	import { colors } from '@stores/layoutStore.js';
</script>

<div class="w-full px-12 lg:flex">
	{#key $playlists}
		{#each $playlists?.items as playlist, index}
			<a class="w-full lg:w-1/4" sveltekit:prefetch href={`/playlist/${playlist.id}`}>
				<div
					class={`bg-[${colors[index]}] rounded-full w-full aspect-square flex justify-center items-center`}
				>
					<div class="bg-white rounded-full h-1/3 w-1/3" />
				</div>
			</a>
		{/each}
	{/key}
</div>
