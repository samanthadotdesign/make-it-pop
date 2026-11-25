<script>
	export let items;
</script>

<ul class="playlist-list" aria-label="Playlists">
	{#each items as playlist (playlist.id)}
		<li>
			<a href={playlist.path ?? `/playlist/${playlist.id}`}>
				<span>{playlist.name}</span>
				{#if playlist.artist}<small>{playlist.artist}</small>{/if}
			</a>
		</li>
	{/each}
</ul>

<style>
	.playlist-list {
		width: min(42rem, 100%);
		margin: 2rem auto;
		padding: 0 2rem 2rem;
	}

	a {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem 1rem;
		padding: 1rem 0;
		border-bottom: 1px solid #d2d2d2;
		text-decoration: none;
	}

	a:hover span {
		text-decoration: underline;
	}
</style>
