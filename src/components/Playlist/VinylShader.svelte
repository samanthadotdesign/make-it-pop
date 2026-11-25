<script>
	import { createEventDispatcher } from 'svelte';
	import { attachVinylShader } from '../../utils/vinylShaderRenderer.js';

	export let kind;
	export let properties = {};
	export let animate = true;
	export let visible = null;
	export let playheadTimeline = null;

	const dispatch = createEventDispatcher();
	const surface = (canvas) => dispatch('surface', { canvas });
	const frame = (canvas) => dispatch('frame', { canvas });
</script>

<canvas
	aria-hidden="true"
	use:attachVinylShader={{ kind, properties, animate, visible, playheadTimeline, surface, frame }}
/>

<style>
	canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
