import * as T from 'three';

// Stage illumination is separate from the asset's materials and the reflection
// map. The matte sweep and contact occlusion are opaque, so the acrylic can
// refract them when Three builds its transmission buffer.
export function createStudioStage(renderer, scene, modelRoot) {
	const environment = createStudioEnvironment(renderer);
	const feet = modelRoot.getObjectByName('IsolationFeet');
	const plinth = modelRoot.getObjectByName('AcrylicChassis');
	const scale = feet?.getWorldScale(new T.Vector3()).x ?? 1;
	const backdrop = new T.Color(0xc8c8c8);
	scene.background = backdrop;
	scene.fog = new T.Fog(backdrop, 19 * scale, 65 * scale);
	scene.environment = environment.texture;
	scene.environmentIntensity = 1;

	const fill = new T.HemisphereLight(0xffffff, 0xacacac, 0.29);
	const key = new T.DirectionalLight(0xffffff, 0.67);
	key.position.set(-3, 7, 4).multiplyScalar(scale);
	key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024);
	Object.assign(key.shadow.camera, {
		left: -5 * scale,
		right: 5 * scale,
		top: 5 * scale,
		bottom: -5 * scale,
		near: 0.1 * scale,
		far: 24 * scale
	});
	key.shadow.camera.updateProjectionMatrix();
	key.shadow.normalBias = 0.013 * scale;
	key.shadow.bias = -0.00015;
	key.shadow.radius = 4;
	const rim = new T.DirectionalLight(0xffffff, 0.19);
	rim.position.set(4, 3, -4).multiplyScalar(scale);
	scene.add(fill, key, rim);

	const floorMaterial = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
	const footContacts = Array.from({ length: 4 }, () => new T.Vector3(20, 20, 20));
	const plinthContact = new T.Vector3(20, 20, 20);
	// Mounted isolator centers in model coordinates. Survives merging chrome
	// meshes inside the dynamically positioned IsolationFeet group.
	const footCenters = [
		[-1.12, -1.38],
		[1.15, -1.38],
		[-1.78, 1.38],
		[1.78, 1.38]
	];
	const frameScale = new T.Vector3();
	const studioScale = { value: 1 };
	floorMaterial.onBeforeCompile = (shader) => {
		shader.uniforms.studioFeet = { value: footContacts };
		shader.uniforms.studioPlinth = { value: plinthContact };
		shader.uniforms.studioScale = studioScale;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vStudioPosition;')
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvStudioPosition=(modelMatrix*vec4(transformed,1.0)).xyz;'
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>
        varying vec3 vStudioPosition;
        uniform vec3 studioFeet[4];
        uniform vec3 studioPlinth;
        uniform float studioScale;`
			)
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
        vec2 studioXZ = vStudioPosition.xz;
        // Subtle white-to-gray luminance sweep. Nothing in it changes hue.
        vec2 keyOffset = ((studioXZ - studioPlinth.xz) / studioScale - vec2(-1.8, -1.4)) / vec2(5.7, 4.1);
        float sweep = 0.68 + 0.31 * exp(-dot(keyOffset, keyOffset));
        float occlusion = 1.0;
        for (int i = 0; i < 4; ++i) {
          float elevation = max(0.0, studioFeet[i].y - vStudioPosition.y) / studioScale;
          float distanceFromFoot = max(0.0, length(studioXZ - studioFeet[i].xz) / studioScale - 0.178);
          float edge = distanceFromFoot / (0.086 + elevation * 0.33);
          occlusion *= 1.0 - 0.43 * exp(-edge * edge - elevation * 9.0);
        }
        float deckGap = max(0.0, (studioPlinth.y - vStudioPosition.y) / studioScale - 0.15);
        vec2 deckRadius = vec2(2.0,1.63) + deckGap * 0.22;
        vec2 deckXY = (studioXZ - studioPlinth.xz) / (deckRadius * studioScale);
        float deckMask = exp(-1.55 * dot(deckXY, deckXY));
        occlusion *= 1.0 - 0.20 * deckMask * exp(-deckGap * 1.35);
        diffuseColor.rgb *= sweep * occlusion;`
			);
	};
	floorMaterial.customProgramCacheKey = () => 'at-lpa2-studio-sweep-v1';
	const floor = new T.Mesh(new T.PlaneGeometry(180 * scale, 180 * scale), floorMaterial);
	floor.name = 'NeutralStudioSweep';
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);

	function setExplosion(explosion = 0) {
		floor.position.y = (-0.002 - explosion * 0.52) * scale;
		if (feet) {
			feet.updateWorldMatrix(true, false);
			studioScale.value = Math.max(0.0001, frameScale.setFromMatrixScale(feet.matrixWorld).x);
			let lowestContact = Infinity;
			for (const [index, [x, z]] of footCenters.entries()) {
				const foot = footContacts[index].set(x, 0, z).applyMatrix4(feet.matrixWorld);
				lowestContact = Math.min(lowestContact, foot.y);
			}
			floor.position.y = lowestContact - 0.002 * studioScale.value;
		}
		plinth?.getWorldPosition(plinthContact);
	}
	setExplosion();

	return {
		floor,
		setExplosion,
		dispose() {
			scene.remove(floor, fill, key, rim);
			floor.geometry.dispose();
			floorMaterial.dispose();
			key.shadow.dispose();
			if (scene.environment === environment.texture) scene.environment = null;
			environment.dispose();
		}
	};
}

// Reflection studio with a neutral sweep and distinct softbox strips. Every
// emitter is grayscale, so it cannot colour the acrylic or the metal.
export function createStudioEnvironment(renderer) {
	const studio = new T.Scene();
	// Low-order spherical field: smooth, grayscale and seamless at box corners.
	// Keep the coefficients synchronized through generate-studio-hdr.py's parser.
	// Its base-room range is ~0.146–0.551 linear radiance over the whole sphere.
	const ROOM_GRADIENT = [0.34, 0.11, -0.07, 0.075, 0.09, 0.035];
	function roomRadiance(direction) {
		const { x, y, z } = direction;
		const c = ROOM_GRADIENT;
		return c[0] + c[1] * x + c[2] * z + c[3] * y + c[4] * (x * x - z * z) + c[5] * x * z;
	}
	const room = new T.Mesh(
		new T.BoxGeometry(30, 24, 30),
		new T.ShaderMaterial({
			side: T.BackSide,
			uniforms: { roomGradient: { value: ROOM_GRADIENT } },
			vertexShader: `varying vec3 vRoomDirection;
      void main(){
        vRoomDirection=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
			fragmentShader: `uniform float roomGradient[6]; varying vec3 vRoomDirection;
      void main(){
        vec3 d=normalize(vRoomDirection);
        float value=roomGradient[0]+roomGradient[1]*d.x+roomGradient[2]*d.z+
          roomGradient[3]*d.y+roomGradient[4]*(d.x*d.x-d.z*d.z)+roomGradient[5]*d.x*d.z;
        gl_FragColor=vec4(vec3(value),1.0);
      }`
		})
	);
	studio.add(room);
	const smooth = (value) => {
		const t = T.MathUtils.clamp(value, 0, 1);
		return t * t * (3 - 2 * t);
	};
	function softboxWeight(u, v) {
		// Match generate-studio-hdr.py. Softly rolled source edges and the fabric
		// centre-to-edge falloff prevent rigid grey bands across curved chrome.
		const feather = smooth(Math.min(u, 1 - u) / 0.14) * smooth(Math.min(v, 1 - v) / 0.075);
		return feather * (0.76 + 0.24 * Math.sin(Math.PI * u)) * (0.88 + 0.12 * Math.sin(Math.PI * v));
	}
	function card(position, size, intensity, color = 0xffffff) {
		const width = 128,
			height = 256,
			pixels = new Uint16Array(width * height * 4);
		const peak = new T.Color(color).multiplyScalar(intensity);
		const origin = new T.Vector3(...position),
			normal = origin.clone().negate().normalize();
		const axisX = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), normal);
		if (axisX.lengthSq() === 0) {
			normal.z += 0.0001;
			normal.normalize();
			axisX.crossVectors(new T.Vector3(0, 1, 0), normal);
		}
		axisX.normalize();
		const axisY = new T.Vector3().crossVectors(normal, axisX),
			direction = new T.Vector3();
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++) {
				const u = (x + 0.5) / width,
					v = (y + 0.5) / height;
				const weight = softboxWeight(u, v),
					offset = (y * width + x) * 4;
				direction
					.copy(origin)
					.addScaledVector(axisX, (u - 0.5) * size[0])
					.addScaledVector(axisY, (v - 0.5) * size[1])
					.normalize();
				const background = roomRadiance(direction);
				for (let channel = 0; channel < 3; channel++) {
					const key = ['r', 'g', 'b'][channel];
					pixels[offset + channel] = T.DataUtils.toHalfFloat(
						T.MathUtils.lerp(background, peak[key], weight)
					);
				}
				pixels[offset + 3] = T.DataUtils.toHalfFloat(1);
			}
		const map = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.HalfFloatType);
		map.colorSpace = T.NoColorSpace;
		map.minFilter = map.magFilter = T.LinearFilter;
		map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
		map.generateMipmaps = false;
		map.needsUpdate = true;
		const material = new T.MeshBasicMaterial({
			color: 0xffffff,
			map,
			side: T.DoubleSide
		});
		const panel = new T.Mesh(new T.PlaneGeometry(...size), material);
		panel.position.set(...position);
		panel.lookAt(0, 0, 0);
		studio.add(panel);
	}

	// Narrow key and rim create readable strips on curved chrome and glass.
	card([-5.4, 4.1, -7.8], [1.3, 8], 2.85);
	card([6.4, 2.9, 1.1], [0.92, 7.3], 3.15);
	card([2.5, 3.7, -7.6], [4.6, 0.68], 2.35);
	// Broader, gentler fill gives machined faces a silver midtone.
	card([-8.8, 4.2, -5.8], [2, 7.2], 1.3);
	card([0, 8, 0.1], [3, 2.8], 0.85);
	card([0, -6, 0], [10, 10], 0.42);
	// Two low strips appear in the front and right edges of the acrylic chassis.
	card([-4, -1.7, 6.8], [5.7, 0.72], 1.9);
	card([5.6, -2.6, -6.1], [4.4, 0.75], 1.8);
	// Gray negative fill keeps the highlights distinct from the silver midtones.
	card([-7.5, 0, -1.8], [2.7, 7.5], 0.08);
	card([7.5, 0.65, -5.5], [2.8, 6.9], 0.1);

	// Capture once at 512 pixels per face to retain narrow highlights. Three's
	// fromScene helper renders at 256 and applies any extra blur up front.
	const cube = new T.WebGLCubeRenderTarget(512, {
		type: T.HalfFloatType,
		colorSpace: T.LinearSRGBColorSpace
	});
	new T.CubeCamera(0.1, 40, cube).update(renderer, studio);
	const pmrem = new T.PMREMGenerator(renderer);
	const target = pmrem.fromCubemap(cube.texture);
	pmrem.dispose();
	cube.dispose();
	studio.traverse((object) => {
		object.geometry?.dispose();
		object.material?.map?.dispose();
		object.material?.dispose();
	});
	return target;
}
