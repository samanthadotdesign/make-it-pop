<script>
	import { base } from '$app/paths';
	import ShelfIcon from './ShelfIcon.svelte';

	export let session = null;

	$: canPause = session?.canPause;
	$: recordName = session?.record?.name;
	$: trackName = session?.track?.title;
	$: status = session?.status || (canPause ? 'Now playing' : 'Paused');
	$: title = trackName && trackName !== recordName ? `${recordName} · ${trackName}` : recordName;
</script>

{#if session?.record}
	<div class="now-playing" role="group" aria-label="Now playing">
		<div class="metadata" aria-live="polite" aria-atomic="true">
			<p class="status">{status}</p>
			<p class="record-name" {title}>{recordName}</p>
		</div>
		<button
			class="control"
			type="button"
			disabled={!session.canToggle}
			aria-label={canPause ? 'Pause playback' : 'Resume playback'}
			on:click={session.togglePlayback}
		>
			<ShelfIcon name={canPause ? 'pause' : 'play'} />
		</button>
		<a
			class="control"
			href="{base}{session.record.path}?return=1"
			aria-label="Return to 3D player"
			title="Return to 3D player"
		>
			<ShelfIcon name="deck" />
		</a>
	</div>
{/if}

<style>
	.now-playing {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: min(100%, 320px);
		min-height: 50px;
		margin-inline: auto;
		padding: 2px 4px 2px 14px;
		border: 1px solid #15151520;
		background: #ffffff30;
		color: #151515;
	}

	.metadata {
		flex: 1;
		min-width: 0;
	}

	.metadata p {
		overflow: hidden;
		margin: 0;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		color: #2d2d2d;
		font-size: 11px;
		line-height: 1.2;
	}

	.record-name {
		font-size: 14px;
		line-height: 1.35;
	}

	.control {
		display: grid;
		place-items: center;
		flex: 0 0 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.control:hover:not(:disabled) {
		background: #15151513;
	}

	.control:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}

	.control:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
