<script>
	import { base } from '$app/paths';
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		CanvasTexture,
		LinearFilter,
		MOUSE,
		NeutralToneMapping,
		PCFShadowMap,
		PerspectiveCamera,
		Raycaster,
		Scene,
		SRGBColorSpace,
		TOUCH,
		Vector2,
		WebGLRenderer
	} from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { loadTurntable } from '$lib/turntable/load-model.js';
	import { createAcrylicRenderPass } from '$lib/turntable/optical-preview.js';
	import { createStudioStage } from '$lib/turntable/studio-environment.js';

	export let recordColor;
	export let labelColor;
	export let recordSource = null;
	export let inspectable = false;

	const dispatch = createEventDispatcher();
	const restingPhases = new Set(['product', 'paused', 'playing', 'exchange']);
	const raycaster = new Raycaster();
	const pointer = new Vector2();
	const fallbackMotion = { stylusLanded: true, sequenceComplete: true, exchangeReady: true };
	let canvas;
	let model;
	let camera;
	let controls;
	let press;
	let recordTexture;
	let ready = false;
	let unavailable = false;
	let pendingCue = false;
	let pendingAssembly = false;
	let pendingExchange = false;
	let needsDraw = true;
	let finishMotion = false;

	$: if (model) applyRecordDesign(model, recordSource, recordColor, labelColor);

	function applyRecordDesign(deck, source, color, label) {
		const vinyl = deck.parts.VinylDisc.material;
		const nextSource = source?.width && source?.height ? source : null;

		if (nextSource !== (recordTexture?.image ?? null)) {
			recordTexture?.dispose();
			recordTexture = nextSource ? new CanvasTexture(nextSource) : null;
			if (recordTexture) {
				// The model already projects the full round artwork through its planar glTF UVs.
				recordTexture.flipY = false;
				recordTexture.colorSpace = SRGBColorSpace;
				recordTexture.generateMipmaps = false;
				recordTexture.minFilter = LinearFilter;
				recordTexture.magFilter = LinearFilter;
			}
			vinyl.map = recordTexture;
			vinyl.needsUpdate = true;
		}

		vinyl.color.set(recordTexture ? '#ffffff' : color ?? '#535350');
		deck.materials.label.color.set(label ?? '#f0e6ce');
		needsDraw = true;
	}

	function publishMotion(motion) {
		if (pendingCue && motion.stylusLanded) {
			pendingCue = false;
			dispatch('cue');
		}
		if (pendingAssembly && motion.sequenceComplete) {
			pendingAssembly = false;
			dispatch('assembled');
		}
		if (pendingExchange && motion.exchangeReady) {
			pendingExchange = false;
			dispatch('exchange');
		}
	}

	function redrawMotion() {
		needsDraw = true;
		finishMotion = true;
	}

	export function start() {
		if (pendingAssembly || model?.playback.state.wantsPlayback) return;
		pendingCue = true;
		pendingAssembly = true;
		pendingExchange = false;
		model?.playback.startPlayback();
		redrawMotion();
		if (unavailable) publishMotion(fallbackMotion);
	}

	export function pause() {
		pendingCue = false;
		pendingAssembly = false;
		if (model?.playback.state.wantsPlayback) {
			model.playback.pausePlayback();
			redrawMotion();
		}
	}

	export function unload() {
		pendingCue = false;
		pendingAssembly = false;
		pendingExchange = true;
		model?.playback.unloadPlayback();
		redrawMotion();
		if (unavailable) publishMotion(fallbackMotion);
	}

	export function inspectPaused() {
		model?.playback.inspectPaused();
		redrawMotion();
	}

	function pointerDown(event) {
		if (!inspectable || !event.isPrimary || event.button !== 0) {
			press = undefined;
			return;
		}
		press = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function pointerMove(event) {
		if (
			press?.id === event.pointerId &&
			Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6
		) {
			press = undefined;
		}
	}

	function pointerUp(event) {
		pointerMove(event);
		if (press?.id !== event.pointerId) return;
		press = undefined;
		if (!ready || !inspectable) return;

		const bounds = canvas.getBoundingClientRect();
		pointer.set(
			2 * ((event.clientX - bounds.left) / bounds.width) - 1,
			1 - 2 * ((event.clientY - bounds.top) / bounds.height)
		);
		if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) return;
		raycaster.setFromCamera(pointer, camera);
		for (const { object } of raycaster.intersectObject(model.root, true)) {
			let ancestor = object;
			while (ancestor?.visible) ancestor = ancestor.parent;
			if (ancestor) continue;
			dispatch('inspect');
			break;
		}
	}

	function pointerCancel() {
		press = undefined;
	}

	function onKeydown(event) {
		if (!inspectable || (event.key !== 'Enter' && event.key !== ' ')) return;
		event.preventDefault();
		if (!event.repeat) dispatch('inspect');
	}

	function disposeModel(root) {
		const resources = new Set();
		const bitmaps = new Set();
		root.traverse((object) => {
			if (!object.isMesh) return;
			resources.add(object.geometry);
			for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
				resources.add(material);
				for (const value of Object.values(material)) {
					if (!value?.isTexture) continue;
					resources.add(value);
					if (typeof value.image?.close === 'function') bitmaps.add(value.image);
				}
			}
		});
		for (const resource of resources) resource.dispose();
		for (const bitmap of bitmaps) bitmap.close();
	}

	onMount(() => {
		let disposed = false;
		let renderer;
		let stage;
		let optics;
		let observer;
		const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

		function release() {
			if (disposed) return;
			disposed = true;
			canvas?.removeEventListener('webglcontextlost', usePoster);
			observer?.disconnect();
			renderer?.setAnimationLoop(null);
			controls?.dispose();
			optics?.dispose();
			stage?.dispose();
			if (model) disposeModel(model.root);
			renderer?.dispose();
			model = undefined;
			recordTexture = null;
		}

		function usePoster() {
			if (disposed) return;
			release();
			ready = false;
			unavailable = true;
			publishMotion(fallbackMotion);
		}

		async function open() {
			renderer = new WebGLRenderer({ canvas, antialias: true });
			canvas.addEventListener('webglcontextlost', usePoster);
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
			renderer.toneMapping = NeutralToneMapping;
			renderer.toneMappingExposure = 1.02;
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = PCFShadowMap;

			const loaded = await loadTurntable(`${base}/models/acrylic-turntable.glb`);
			if (disposed) {
				disposeModel(loaded.root);
				return;
			}

			model = loaded;
			applyRecordDesign(model, recordSource, recordColor, labelColor);

			const scene = new Scene();
			scene.add(model.root);
			stage = createStudioStage(renderer, scene, model.root);
			optics = createAcrylicRenderPass(renderer, model.root);

			camera = new PerspectiveCamera(31, 1, 0.01, 8);
			camera.position.set(0.695, 0.592, 1.03);
			controls = new OrbitControls(camera, canvas);
			controls.target.set(0, 0.13, 0);
			controls.enableDamping = true;
			controls.minDistance = 0.32;
			controls.maxDistance = 2.4;
			controls.maxPolarAngle = Math.PI / 2 - 0.035;
			controls.mouseButtons.LEFT = MOUSE.PAN;
			controls.mouseButtons.RIGHT = MOUSE.ROTATE;
			controls.touches.ONE = TOUCH.PAN;
			controls.listenToKeyEvents(canvas);

			function resize() {
				const width = Math.max(1, canvas.clientWidth);
				const height = Math.max(1, canvas.clientHeight);
				camera.aspect = width / height;
				renderer.setSize(width, height, false);
				needsDraw = true;
			}
			observer = new ResizeObserver(resize);
			observer.observe(canvas);
			resize();

			if (pendingAssembly) model.playback.startPlayback({ fromExploded: true });
			else if (pendingExchange) model.playback.unloadPlayback();
			let previousTime = performance.now();
			let previousExplosion = 0;
			let previousRotation = 0;
			let previousCover = 1;
			let previousPhase;
			let textureTime = 0;

			renderer.setAnimationLoop((now) => {
				if (disposed) return;
				const reduceMotion = motionPreference.matches;
				controls.enableDamping = !reduceMotion;
				// Finish the mechanical sequence quickly when reduced motion is enabled.
				const step =
					reduceMotion && finishMotion ? 12 : Math.min((now - previousTime) / 1000, 0.05);
				const motion = model.playback.update(step);
				previousTime = now;
				finishMotion = false;

				const rotation = reduceMotion ? 0 : motion.rotation;
				const coverMoving = Math.abs(motion.cover - previousCover) > 0.0001;
				const recordVisible = motion.showRecord;
				const liveArtwork =
					!reduceMotion && recordTexture && recordVisible && now - textureTime >= 80;
				const lift = (motion.explosion - previousExplosion) * 0.035;
				// Move the framing with the exploded deck without overwriting a user's pan.
				controls.target.y += lift;
				camera.position.y += lift;
				const cameraMoved = controls.update();
				const motionChanged = motion.phase !== previousPhase || !restingPhases.has(motion.phase);
				if (
					!needsDraw &&
					!cameraMoved &&
					!motionChanged &&
					!coverMoving &&
					!liveArtwork &&
					rotation === previousRotation
				)
					return;

				try {
					model.applyMotion(motion);
					model.parts.Record.rotation.y = rotation;
					model.parts.Platter.rotation.y = rotation;
					stage.setExplosion(motion.explosion);
					camera.zoom = (1 - 0.23 * motion.explosion) * Math.min(1, camera.aspect / 0.87);
					camera.updateProjectionMatrix();

					if (liveArtwork) {
						recordTexture.needsUpdate = true;
						textureTime = now;
					}
					optics.render(scene, camera, motion.explosion);
				} catch {
					usePoster();
					return;
				}

				needsDraw = false;
				previousRotation = rotation;
				previousPhase = motion.phase;
				previousExplosion = motion.explosion;
				previousCover = motion.cover;
				if (!ready) ready = true;
				publishMotion(motion);
			});
		}

		open().catch(usePoster);
		return release;
	});
</script>

<div class="turntable stage">
	{#if unavailable}
		<img src="{base}/models/studio-hero.jpg" alt="Clear acrylic turntable with silver hardware" />
	{:else if !ready}
		<p class="loading" role="status">Loading turntable…</p>
	{/if}
	<canvas
		bind:this={canvas}
		class:ready
		tabindex={ready ? 0 : -1}
		aria-label={inspectable
			? '3D turntable. Drag or use the arrow keys to pan. Press Enter to see the separated parts.'
			: '3D turntable. Drag or use the arrow keys to pan.'}
		on:pointerdown={pointerDown}
		on:pointermove={pointerMove}
		on:pointerup={pointerUp}
		on:pointercancel={pointerCancel}
		on:lostpointercapture={pointerCancel}
		on:keydown={onKeydown}
	/>
</div>

<style>
	.stage {
		--fade-depth: min(72px, 18%);
		--stage-mask: linear-gradient(
			transparent,
			black var(--fade-depth),
			black calc(100% - var(--fade-depth)),
			transparent
		);
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--player-background, #c8c8c8);
	}

	img,
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		-webkit-mask-image: var(--stage-mask);
		mask-image: var(--stage-mask);
	}

	img {
		object-fit: contain;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #414141;
		font-size: 0.875rem;
		opacity: 0;
		animation: show-loading 150ms ease-out 250ms forwards;
	}

	@keyframes show-loading {
		to {
			opacity: 1;
		}
	}

	canvas {
		visibility: hidden;
		opacity: 0;
		cursor: grab;
		touch-action: none;
		transition: opacity 180ms ease-out;
	}

	canvas:active {
		cursor: grabbing;
	}

	canvas.ready {
		visibility: visible;
		opacity: 1;
	}

	.stage:has(canvas:focus-visible) {
		outline: 2px solid #323232;
		outline-offset: -3px;
	}

	@media (prefers-reduced-motion: reduce) {
		canvas {
			transition: none;
		}

		.loading {
			animation-duration: 0s;
		}
	}
</style>
