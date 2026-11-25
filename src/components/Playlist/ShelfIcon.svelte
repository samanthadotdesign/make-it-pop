<script>
	import { base } from '$app/paths';

	export let name;
	const assetRoot = `${base}/images/shelf`;
</script>

<span class="icon" aria-hidden="true">
	{#if name === 'deck'}
		<img class="platter" src="{assetRoot}/deck-platter.svg" alt="" />
		<img class="deck-outline" src="{assetRoot}/deck-outline.svg" alt="" />
		<img class="arm" src="{assetRoot}/deck-arm.svg" alt="" />
	{:else}
		<img class:pause={name === 'pause'} src="{assetRoot}/{name}.svg" alt="" />
	{/if}
</span>

<style>
	.icon {
		display: block;
		position: relative;
		width: 24px;
		height: 24px;
		flex: none;
	}

	img {
		position: absolute;
		display: block;
		width: 100%;
		height: 100%;
	}

	.platter {
		inset: 25.42% 40% 29.58% 15%;
		width: 45%;
		height: 45%;
	}

	.deck-outline {
		inset: 8.33%;
		width: 83.34%;
		height: 83.34%;
	}

	.arm {
		inset: 9.35% 10.07% 28.42% 59.34%;
		width: 30.59%;
		height: 62.23%;
	}

	.pause {
		inset: 20.833% 33.333%;
		width: 33.334%;
		height: 58.334%;
	}
</style>
