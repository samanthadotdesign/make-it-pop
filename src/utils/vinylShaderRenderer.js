import { vertexShader, vinylShaders } from './vinylShaderSources.js';

const figmaShaders = {
	galaxy: () => import('./vinylShaders/galaxy.ts'),
	moving: () => import('./vinylShaders/moving-gradient.ts'),
	water: () => import('./vinylShaders/water-caustic.ts')
};

let deviceRequest;

function getDevice() {
	if (!navigator.gpu) return null;
	if (!deviceRequest) {
		deviceRequest = navigator.gpu
			.requestAdapter({ powerPreference: 'low-power' })
			.then((adapter) => adapter?.requestDevice())
			.catch(() => null);
		deviceRequest.then((device) => {
			if (device) device.lost.then(() => (deviceRequest = undefined));
		});
	}
	return deviceRequest;
}

async function createFigmaRenderer(kind, initialProperties) {
	const device = await getDevice();
	if (!device) return null;
	const shader = await figmaShaders[kind]();
	const surface = document.createElement('canvas');
	const context = surface.getContext('webgpu');
	if (!context) return null;
	const format = navigator.gpu.getPreferredCanvasFormat();
	context.configure({ device, format, alphaMode: 'premultiplied' });
	const state = {};
	const frame = { state, output: null, time: 0, params: initialProperties };

	function draw(width, height, time, params) {
		if (surface.width !== width) surface.width = width;
		if (surface.height !== height) surface.height = height;
		frame.output = context.getCurrentTexture();
		frame.params = params;
		frame.time = time;
		shader.render(device, frame);
	}

	function destroy() {
		for (const key of [
			'quad',
			'uniformBuf',
			'vertexBuffer',
			'indexBuffer',
			'msaaTexture',
			'depthTexture'
		]) {
			state[key]?.destroy();
		}
		context.unconfigure();
	}

	device.pushErrorScope('validation');
	let error;
	try {
		shader.setup(device, frame);
		draw(32, 32, 0, initialProperties);
	} catch (reason) {
		error = reason;
	}
	const validationError = await device.popErrorScope();
	if (error || validationError) {
		destroy();
		return null;
	}

	return { surface, draw, destroy, name: 'figma-webgpu', lost: device.lost };
}

function compile(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
	gl.deleteShader(shader);
	return null;
}

const galaxyDefaults = {
	movementSpeed: 1,
	starDensity: 0.5,
	gradientStart: { r: 0.039, g: 0.039, b: 0.18 },
	gradientEnd: { r: 0, g: 0, b: 0.02 },
	nebulaColor: { r: 0.29, g: 0.1, b: 0.478 },
	galaxyRotation: 0,
	starSize: 0.3
};

const waterDefaults = {
	waterColor: { r: 0, g: 0.388, b: 0.706, a: 1 },
	highlightColor: { r: 0.804, g: 0.961, b: 1, a: 1 },
	intensity: 0.5,
	playhead: 0,
	scale: 1,
	center: { x: 50, y: 50 }
};

function createStaticRenderer(kind) {
	const surface = document.createElement('canvas');
	const context = surface.getContext('2d');
	const cssColor = ({ r, g, b, a = 1 }) => `rgb(${r * 255} ${g * 255} ${b * 255} / ${a})`;

	return {
		surface,
		name: 'static',
		draw(width, height, time, properties) {
			surface.width = width;
			surface.height = height;
			const gradient = context.createRadialGradient(
				width * 0.33,
				height * 0.37,
				0,
				width * 0.5,
				height * 0.5,
				width * 0.71
			);
			const defaults = webGlUniforms(kind, properties);
			if (kind === 'moving') {
				const stops = properties.gradient?.stops ?? [
					{ position: 0, color: defaults.color1 },
					{ position: 0.5, color: defaults.color2 },
					{ position: 1, color: defaults.color3 }
				];
				for (const { position, color } of stops) {
					gradient.addColorStop(Math.max(0, Math.min(1, position)), cssColor(color));
				}
			} else if (kind === 'galaxy') {
				gradient.addColorStop(0, cssColor(defaults.nebulaColor));
				gradient.addColorStop(0.5, cssColor(defaults.gradientStart));
				gradient.addColorStop(1, cssColor(defaults.gradientEnd));
			} else {
				gradient.addColorStop(0, cssColor(defaults.highlightColor));
				gradient.addColorStop(0.6, cssColor(defaults.waterColor));
			}
			context.fillStyle = gradient;
			context.fillRect(0, 0, width, height);
		},
		destroy() {
			surface.width = 1;
			surface.height = 1;
		}
	};
}

function webGlUniforms(kind, props) {
	if (kind === 'galaxy') return { ...galaxyDefaults, ...props };
	if (kind === 'water') return { ...waterDefaults, ...props };
	const stops = props.gradient?.stops;
	return {
		color1: stops?.[0]?.color ?? { r: 0.43, g: 0.43, b: 1 },
		color2: stops?.[Math.floor(stops.length / 2)]?.color ?? { r: 0.67, g: 0.44, b: 0.86 },
		color3: stops?.[stops.length - 1]?.color ?? { r: 1, g: 0, b: 0.6078 },
		twist: Math.min(0.35, (props.twist ?? 0.04) * 1.8 + (props.warp ?? 0.26) * 0.2),
		morphSpeed: props.morphSpeed ?? 3.74,
		rotationSpeed: props.rotationSpeed ?? 12
	};
}

function createWebGLRenderer(kind) {
	const surface = document.createElement('canvas');
	const gl = surface.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true });
	if (!gl) return null;
	const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
	const fragment = compile(gl, gl.FRAGMENT_SHADER, vinylShaders[kind]);
	if (!vertex || !fragment) {
		if (vertex) gl.deleteShader(vertex);
		if (fragment) gl.deleteShader(fragment);
		return null;
	}
	const program = gl.createProgram();
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		gl.deleteProgram(program);
		return null;
	}
	const uniforms = new Map();
	for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
		const { name, type } = gl.getActiveUniform(program, i);
		uniforms.set(name, { location: gl.getUniformLocation(program, name), type });
	}

	function draw(width, height, time, props) {
		if (surface.width !== width) surface.width = width;
		if (surface.height !== height) surface.height = height;
		gl.viewport(0, 0, width, height);
		gl.useProgram(program);
		const values = webGlUniforms(kind, props);
		for (const [name, { location, type }] of uniforms) {
			const value = values[name];
			if (name === 'resolution') gl.uniform2f(location, width, height);
			else if (name === 'elapsed') gl.uniform1f(location, time / 1000);
			else if (type === gl.FLOAT) gl.uniform1f(location, value);
			else if (type === gl.FLOAT_VEC2) gl.uniform2f(location, value.x, value.y);
			else if (type === gl.FLOAT_VEC3) gl.uniform3f(location, value.r, value.g, value.b);
			else if (type === gl.FLOAT_VEC4)
				gl.uniform4f(location, value.r, value.g, value.b, value.a ?? 1);
		}
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	return {
		surface,
		draw,
		name: kind === 'moving' ? 'gradient-webgl-fallback' : 'figma-webgl-port',
		destroy() {
			gl.deleteProgram(program);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		}
	};
}

export function attachVinylShader(canvas, initialOptions) {
	const context = canvas.getContext('2d');
	if (!context) return {};
	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
	let options = initialOptions;
	let renderer;
	let initialization = 0;
	let disposed = false;
	let intersecting = false;
	let needsRender = true;
	let frame = 0;
	let elapsed = 0;
	let previousTime = null;
	let ready = false;

	function shouldAnimate() {
		if (
			!options.animate ||
			reducedMotion.matches ||
			document.hidden ||
			renderer?.name === 'static' ||
			!(options.visible ?? intersecting)
		)
			return false;
		if (options.kind !== 'water') return true;
		const timeline = options.playheadTimeline;
		return timeline && (timeline.loopMode !== 'once' || elapsed < timeline.durationMs);
	}

	function getProperties() {
		const timeline = options.playheadTimeline;
		if (!timeline || reducedMotion.matches) return options.properties;
		const position = timeline.durationMs > 0 ? elapsed / timeline.durationMs : 1;
		let progress = Math.min(1, position);
		if (timeline.loopMode === 'loop') progress = position % 1;
		if (timeline.loopMode === 'boomerang') progress = 1 - Math.abs((position % 2) - 1);
		return {
			...options.properties,
			playhead: timeline.from + (timeline.to - timeline.from) * progress
		};
	}

	function invalidate() {
		needsRender = true;
		schedule();
	}

	function schedule() {
		if (disposed || !renderer || frame) return;
		if (needsRender || shouldAnimate()) frame = requestAnimationFrame(draw);
	}

	function draw(time) {
		frame = 0;
		const playing = shouldAnimate();
		const delta = previousTime === null ? 0 : time - previousTime;
		if (!needsRender && playing && previousTime !== null && delta < 31) {
			schedule();
			return;
		}
		if (playing) elapsed += delta;
		previousTime = playing ? time : null;
		const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
		const width = Math.round((canvas.clientWidth || 320) * ratio);
		const height = Math.round((canvas.clientHeight || 320) * ratio);
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		renderer.draw(width, height, reducedMotion.matches ? 0 : elapsed, getProperties());
		context.clearRect(0, 0, width, height);
		context.drawImage(renderer.surface, 0, 0);
		if (!ready) {
			ready = true;
			options.surface(canvas);
		}
		options.frame(canvas);
		needsRender = false;
		schedule();
	}

	async function initialize(webGlOnly = false) {
		const version = ++initialization;
		renderer?.destroy();
		renderer = null;
		ready = false;
		const { kind, properties } = options;
		if (!figmaShaders[kind]) return;
		let backend = null;
		if (!webGlOnly) {
			try {
				backend = await createFigmaRenderer(kind, properties);
			} catch {
				// Shader-capable browsers may still lack a usable WebGPU adapter.
			}
		}
		if (disposed || version !== initialization) {
			backend?.destroy();
			return;
		}
		renderer = backend ?? createWebGLRenderer(kind) ?? createStaticRenderer(kind);
		canvas.dataset.shaderRenderer = renderer.name;
		renderer?.lost?.then(() => {
			if (!disposed && renderer === backend) initialize(true);
		});
		invalidate();
	}

	const size = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
	size?.observe(canvas);
	const visibility =
		typeof IntersectionObserver === 'function'
			? new IntersectionObserver(([entry]) => {
					intersecting = entry.isIntersecting;
					if (!intersecting) previousTime = null;
					schedule();
			  })
			: null;
	visibility?.observe(canvas);
	intersecting = !visibility;
	function motionChanged() {
		previousTime = null;
		invalidate();
	}
	reducedMotion.addEventListener('change', motionChanged);
	document.addEventListener('visibilitychange', motionChanged);
	initialize();

	return {
		update(next) {
			const changedKind = options.kind !== next.kind;
			if (options.visible !== next.visible || options.animate !== next.animate) previousTime = null;
			options = next;
			if (changedKind) {
				elapsed = 0;
				previousTime = null;
				initialize();
			} else {
				invalidate();
			}
		},
		destroy() {
			disposed = true;
			cancelAnimationFrame(frame);
			reducedMotion.removeEventListener('change', motionChanged);
			document.removeEventListener('visibilitychange', motionChanged);
			visibility?.disconnect();
			size?.disconnect();
			renderer?.destroy();
		}
	};
}
