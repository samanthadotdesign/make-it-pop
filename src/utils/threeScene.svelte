<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	import { EffectComposer, RenderPass, EffectPass } from 'postprocessing';

	import RippleEffect from './RippleEffect';
	import AudioAnalysisTexture from './audioAnalysisTexture';
	import { Planes } from './Planes';

	import { get } from 'svelte/store';
	import { interpolate } from 'd3-interpolate';
	import { buildUniforms, getTweenableChanges, getBooleanChanges } from '@utils/uniforms';
	import cloneDeep from 'lodash/cloneDeep';
	import {
		shuffleInterval,
		shuffleIntervalMultiplier,
		playerVolume,
		playerActiveIntervals,
		loudnessAverage,
		beatConfidence,
		red,
		green,
		blue,
		playStatus,
		tempo,
		sync
	} from '@stores/player.js';
	import { tweenDuration, tick as dateTick } from '@stores/visualizerStore.js';

	import image1 from './13.jpg';
	import image2 from './14.jpg';
	import image3 from './15.jpg';

	const images = [image1, image2, image3];

	class Loader {
		constructor() {
			this.items = [];
			this.loaded = [];
		}
		begin(name) {
			this.items.push(name);
		}
		end(name) {
			this.loaded.push(name);
			if (this.loaded.length === this.items.length) {
				this.onComplete();
			}
		}
		onComplete() {}
	}

	export let video;

	let initialize;
	let initializeTexture;

	let animate;
	let audioAnalysisTexture;

	let container;

	let camera, scene, renderer, clock, raycaster, composer;

	let texture, material, mesh, videoCube;

	let hitObjects, assets, data, subjects, loader, rippleEffect, mouse;

	// Scroll tracking
	let scrollY = 0;
	let prevScrollY = 0;
	let scrollVelocity = 0;
	let targetPlaneY = 0;

	let disposed;

	let mouseX = 0;
	let mouseY = 0;

	function loadAssets() {
		return new Promise((resolve, reject) => {
			// loadTextAssets(assets, loader);
			console.log('subjects', subjects);

			subjects.forEach((subject) => subject.load(loader));

			loader.onComplete = () => {
				resolve();
			};
		});
	}

	function initializeComposer() {
		const renderPass = new RenderPass(scene, camera);
		rippleEffect = new RippleEffect({ texture: audioAnalysisTexture.texture });
		const waterPass = new EffectPass(camera, rippleEffect);
		//const outputPass = new OutputPass();

		waterPass.renderToScreen = true;
		renderPass.renderToScreen = false;

		composer.addPass(renderPass);
		composer.addPass(waterPass);
		//composer.addPass(outputPass);
	}

	initializeTexture = () => {
		audioAnalysisTexture.initTexture();

		addHitPlane();
		initializeComposer();

		tick();

		window.addEventListener('resize', onResize);
	};

	function addHitPlane() {
		const viewSize = getViewSize();

		const geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.innerHeight, 1, 1);

		const material = new THREE.MeshBasicMaterial();
		const mesh = new THREE.Mesh(geometry, material);

		hitObjects.push(mesh);
	}

	function getViewSize() {
		const fovInRadians = (camera.fov * Math.PI) / 180;

		const height = Math.abs(camera.position.z * Math.tan(fovInRadians / 2) * 2);

		const result = {
			width: height * camera.aspect,
			height
		};

		return result;
	}

	function update() {
		audioAnalysisTexture.update();

		// Scroll velocity drives ripple distortion
		scrollVelocity = Math.abs(scrollY - prevScrollY);
		prevScrollY = scrollY;
		if (rippleEffect) {
			const targetDistortion = Math.min(scrollVelocity * 0.02, 1.0);
			const current = rippleEffect.uniforms.get('uScrollVelocity').value;
			rippleEffect.uniforms.get('uScrollVelocity').value += (targetDistortion - current) * 0.1;
		}
	}

	function render() {
		composer.render(clock.getDelta());
	}

	function tick() {
		if (disposed) return;

		render();
		update();

		requestAnimationFrame(tick);
	}

	function onResize() {
		camera.aspect = window.innerWidth / window.innerHeight;

		camera.updateProjectionMatrix();
		composer.setSize(window.innerWidth, window.innerHeight);

		subjects.forEach((subject) => {
			subject.onResize(window.innerWidth, window.innerHeight);
		});
	}

	initialize = () => {
		renderer = new THREE.WebGLRenderer({
			antialias: false,
			alpha: true
		});
		renderer.setClearColor(0x000000, 0);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		composer = new EffectComposer(renderer);

		container.appendChild(renderer.domElement);
		renderer.domElement.id = 'webGLApp';

		window.addEventListener('scroll', () => {
			scrollY = window.scrollY;
		});

		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
		camera.position.z = 50;
		disposed = false;
		scene = new THREE.Scene();

		const light = new THREE.DirectionalLight(0xffffff, 3);
		light.position.set(0.5, 1, 1).normalize();
		scene.add(light);

		scene.background = null;

		clock = new THREE.Clock();

		assets = {};
		raycaster = new THREE.Raycaster();
		hitObjects = [];

		audioAnalysisTexture = new AudioAnalysisTexture();

		subjects = [
			new Planes(
				{
					getViewSize,
					scene,
					raycaster,
					onPlaneHover: (plane) => {
						console.log('plane', plane);
					}
				},
				images,
				video
			)
		];

		tick = tick.bind(this);
		onResize = onResize.bind(this);

		initializeTexture = initializeTexture.bind(this);
		loader = new Loader();
		loadAssets().then(initializeTexture);
	};

	function onWindowResize() {
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
		composer.setSize(window.innerWidth, window.innerHeight);
	}

	let _stop = null;
	let intervalIndex = 0;

	$: activeIntervals = $playerActiveIntervals;
	$: volume = $playerVolume;

	$: {
		// Changing the tween duration depending on activeIntervals['bars'] which creates dynamic behaviour on the visualization
		if (activeIntervals) {
			const interval = activeIntervals[shuffleInterval];
			if (interval || (interval && intervalIndex !== interval.index)) {
				intervalIndex = interval.index;
				if (intervalIndex % shuffleIntervalMultiplier == 0) {
					tweenDuration.set(interval.duration * shuffleIntervalMultiplier * 0.9);
				}
			}
		}
	}

	$: {
		if (audioAnalysisTexture) {
			// if audio analysis texture exists, then add a point using the normalized value
			if ($loudnessAverage && $beatConfidence) {
				/* ----- PLAY AROUND WITH NORMALIZING THE VALUES FOR X, Y POINTS ---- */
				const x = $beatConfidence * 100;
				const y = ($loudnessAverage * 100) / -60;

				const point = { x, y, red: $red, green: $green, blue: $blue };
				console.log('point', point);
				audioAnalysisTexture.addPoint(point);
			}
		}
	}

	onMount(() => {
		initialize();

		const syncInterval = setInterval(() => {
			if ($playStatus) {
				dateTick.set(Date.now());
				sync();
			}
		}, 25);

		return () => {
			clearInterval(syncInterval);
			disposed = true;
		};
	});
</script>

<div
	bind:this={container}
	style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; pointer-events: none;"
/>
