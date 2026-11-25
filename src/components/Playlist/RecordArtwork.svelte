<script>
	import { base } from '$app/paths';
	import VinylShader from './VinylShader.svelte';

	export let record;
	export let spinning = false;
	export let animate = true;

	const waterMotion = { from: 0, to: 2, durationMs: 2000, loopMode: 'boomerang' };
	const assetRoot = `${base}/images/shelf`;
</script>

<div
	class="record"
	class:spinning
	aria-hidden="true"
	style="--pressing: {record.color ?? record.tint}"
>
	{#if record.treatment}
		<div class="art" class:dusk={record.finish === 'dusk'}>
			<div class="shader" style="--pressing: {record.treatment.color}">
				<VinylShader
					kind={record.treatment.kind}
					properties={record.treatment.properties}
					{animate}
					playheadTimeline={record.finish === 'water' ? waterMotion : null}
					on:surface
				/>
			</div>
			<img class="grooves" src="{assetRoot}/{record.finish}-grooves.svg" alt="" />
			<img class="label" src="{assetRoot}/{record.finish}-label.svg" alt="" />
		</div>
	{:else}
		<div class="pressing">
			<div class="plain-label" />
		</div>
	{/if}
</div>

<style>
	.record,
	.art,
	.pressing,
	.shader {
		position: absolute;
		inset: 0;
	}

	.record {
		animation: rotate-record 8s linear infinite paused;
		pointer-events: none;
	}

	.spinning {
		animation-play-state: running;
	}

	.dusk {
		inset: 0 6% 6% 0;
	}

	.shader {
		background-color: var(--pressing);
		mask: radial-gradient(
			circle closest-side,
			transparent 2.2%,
			#000 2.45% 99.6%,
			transparent 100%
		);
	}

	.grooves,
	.label {
		position: absolute;
		display: block;
	}

	.grooves {
		inset: 0.33%;
		width: 99.34%;
		height: 99.34%;
	}

	.label {
		inset: 33.34%;
		width: 33.32%;
		height: 33.32%;
	}

	.pressing {
		border-radius: 50%;
		background: repeating-radial-gradient(circle, transparent 0 3px, #1111 3.5px 4px),
			var(--pressing);
		mask: radial-gradient(
			circle closest-side,
			transparent 2.25%,
			#000 2.5% 99.6%,
			transparent 100%
		);
	}

	.plain-label {
		position: absolute;
		inset: 33.34%;
		border-radius: 50%;
		background: color-mix(in srgb, var(--pressing) 30%, #f2ede3);
	}

	@keyframes rotate-record {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.record {
			animation: none;
		}
	}
</style>
