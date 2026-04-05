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
	import { setVideoIndex, setAudioIndex } from '@stores/visualizerStore.js';
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

	let texture, material, mesh, videoCube, videoPlane;
	let currentScrollFlip = 0;

	let hitObjects, assets, data, subjects, loader, rippleEffect, mouse;

	// Scroll tracking
	let scrollY = 0;
	let prevScrollY = 0;
	let scrollVelocity = 0;
	let scrollDirection = 0;
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

		if (video) {
			const videoTexture = new THREE.VideoTexture(video);
			videoTexture.colorSpace = THREE.SRGBColorSpace;
			const viewSize = getViewSize();

			const mat = new THREE.ShaderMaterial({
				uniforms: {
					uVideo: { value: videoTexture },
					uScreenAspect: { value: window.innerWidth / window.innerHeight },
					uVideoAspect: { value: 16 / 9 }
				},
				vertexShader: `
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: `
					uniform sampler2D uVideo;
					uniform float uScreenAspect;
					uniform float uVideoAspect;
					varying vec2 vUv;
					void main() {
						vec2 uv = vUv;
						float ratio = uScreenAspect / uVideoAspect;
						if (ratio < 1.0) {
							uv.x = uv.x * ratio + (1.0 - ratio) * 0.5;
						} else {
							uv.y = uv.y / ratio + (1.0 - 1.0 / ratio) * 0.5;
						}
						gl_FragColor = vec4(texture2D(uVideo, uv).rgb, 1.0);
					}
				`
			});

			const geo = new THREE.PlaneGeometry(viewSize.width, viewSize.height);
			videoPlane = new THREE.Mesh(geo, mat);
			scene.add(videoPlane);
		}

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

		// Decay scroll velocity, slower decay = more fluid linger
		scrollVelocity *= 0.88;

		// Lerp toward target — 0.08 = snappy lead-in, slow snap-back
		const targetFlip = Math.min(scrollVelocity / 200, 1.0) * scrollDirection;
		currentScrollFlip += (targetFlip - currentScrollFlip) * 0.08;

		if (rippleEffect) {
			rippleEffect.uniforms.get('uScrollFlip').value = currentScrollFlip;
			rippleEffect.uniforms.get('uTime').value = clock.getElapsedTime();

			// Drive play intensity from audio data when playing, fallback to 0.4 so wave is always visible
			const _loudness = get(loudnessAverage);
			const _beat = get(beatConfidence);
			const _playing = get(playStatus);
			let targetIntensity = 0.4; // always-on baseline
			if (_playing && _loudness && _beat) {
				targetIntensity = Math.min((_beat * 0.6) + (Math.abs(_loudness) / 60) * 0.4, 1.0);
			}
			const current = rippleEffect.uniforms.get('uPlayIntensity').value;
			rippleEffect.uniforms.get('uPlayIntensity').value += (targetIntensity - current) * 0.1;
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

		const viewSize = getViewSize();
		const newGeo = new THREE.PlaneGeometry(viewSize.width, viewSize.height);
		const newAspect = window.innerWidth / window.innerHeight;
		if (videoPlane) {
			videoPlane.geometry.dispose();
			videoPlane.geometry = newGeo;
			videoPlane.material.uniforms.uScreenAspect.value = newAspect;
		}

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

		window.addEventListener('wheel', (e) => {
			scrollVelocity = Math.min(Math.abs(e.deltaY), 200);
			scrollDirection = e.deltaY > 0 ? 1 : -1;
		}, { passive: true });

		let touchStartY = 0;
		let touchEndY = 0;
		let touchNavigated = false;
		window.addEventListener('touchstart', (e) => {
			touchStartY = e.touches[0].clientY;
			touchEndY = e.touches[0].clientY;
			touchNavigated = false;
		}, { passive: true });
		window.addEventListener('touchmove', (e) => {
			const currentY = e.touches[0].clientY;
			const totalDelta = touchStartY - currentY;
			const frameDelta = touchEndY - currentY;
			touchEndY = currentY;
			scrollVelocity = Math.min(Math.abs(totalDelta) * 1.2, 200);
			if (Math.abs(frameDelta) > 0.5) scrollDirection = frameDelta > 0 ? 1 : -1;
			// Navigate immediately when threshold crossed — no waiting for touchend
			if (!touchNavigated && Math.abs(totalDelta) > 60) {
				touchNavigated = true;
				setVideoIndex(totalDelta > 0);
			}
		}, { passive: true });

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
