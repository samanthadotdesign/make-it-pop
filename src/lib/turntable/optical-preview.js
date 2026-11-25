import {
	HalfFloatType,
	LinearFilter,
	LinearSRGBColorSpace,
	MathUtils,
	ShaderChunk,
	UnsignedByteType,
	Vector2,
	Vector3,
	WebGLRenderTarget
} from 'three';

const plateOptics = /* glsl */ `
#ifdef USE_TRANSMISSION
uniform int acrylicShape;
uniform vec3 acrylicHalfSize;

float acrylicPathLength( vec3 position, vec3 ray, vec3 normal, mat4 model,
                         float wall, out vec3 exitNormal ) {
  exitNormal = normal;
  // Thin dust-cover walls act as parallel plates, even when the cover tilts.
  if ( acrylicShape == 0 ) {
    float wallScale = length( transpose( mat3( model ) ) * normal );
    return wall * wallScale / max( -dot( ray, normal ), 0.45 );
  }

  // Follow the refracted ray to the next wall of the box or round platter.
  // The ray parameter remains in world units for a scaled model.
  vec3 scale = vec3( length( model[0].xyz ), length( model[1].xyz ), length( model[2].xyz ) );
  mat3 axes = mat3( model[0].xyz / scale.x, model[1].xyz / scale.y, model[2].xyz / scale.z );
  vec3 p = transpose( axes ) * ( position - model[3].xyz ) / scale;
  vec3 d = transpose( axes ) * ray / scale;
  vec3 direction = mix( vec3(-1.0), vec3(1.0), step( vec3(0.0), d ) );
  vec3 walls = ( acrylicHalfSize - p * direction ) / max( abs( d ), vec3(1e-6) );
  float distance = walls.y;
  vec3 exitFace = vec3( 0.0, direction.y, 0.0 );

  if ( acrylicShape == 1 ) {
    if ( walls.x < distance ) {
      distance = walls.x;
      exitFace = vec3( direction.x, 0.0, 0.0 );
    }
    if ( walls.z < distance ) {
      distance = walls.z;
      exitFace = vec3( 0.0, 0.0, direction.z );
    }
  } else {
    float a = max( dot( d.xz, d.xz ), 1e-8 );
    float b = dot( p.xz, d.xz );
    float c = dot( p.xz, p.xz ) - acrylicHalfSize.x * acrylicHalfSize.x;
    float rim = ( -b + sqrt( max( 0.0, b * b - a * c ) ) ) / a;
    if ( rim < distance ) {
      distance = rim;
      exitFace = normalize( vec3( p.x + d.x * rim, 0.0, p.z + d.z * rim ) );
    }
  }

  exitNormal = axes * exitFace;
  return max( 0.0, min( distance, 1.45 * wall * scale.y ) );
}
#endif
`;

// Bound the projected displacement where the screen image lacks hidden
// surfaces. Keep the native reflection shader and its specular anti-aliasing.
const transmissionFunctions =
	ShaderChunk.transmission_pars_fragment
		.replace(
			'uniform vec2 transmissionSamplerSize;',
			`uniform vec2 transmissionSamplerSize;
    uniform sampler2D acrylicUnderCover;
    uniform float acrylicCoverMix;`
		)
		.replace(
			'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
			`
    vec4 ordinaryTransmission = textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
    if ( acrylicCoverMix <= 0.0 ) return ordinaryTransmission;
    vec4 throughDeck = texture2D( acrylicUnderCover, clamp( fragCoord, vec2(0.0), vec2(1.0) ) );
    return mix( ordinaryTransmission, throughDeck, acrylicCoverMix );`
		)
		.replace(
			'normalize( refractionVector ) * thickness * modelScale',
			'normalize( refractionVector ) * thickness'
		)
		.replaceAll(
			'refractionCoords /= 2.0;',
			/* glsl */ `
    refractionCoords /= 2.0;
    vec4 surfaceNdc = projMatrix * viewMatrix * vec4( position, 1.0 );
    vec2 surfaceUV = 0.5 * ( surfaceNdc.xy / surfaceNdc.w + 1.0 );
    vec2 offset = refractionCoords - surfaceUV;
    refractionCoords = surfaceUV + offset * min( 1.0, 0.024 / max( length( offset ), 1e-6 ) );
  `
		) + plateOptics;

const transmission = ShaderChunk.transmission_fragment
	.replace(
		'vec4 transmitted =',
		/* glsl */ `
    vec3 glassRay = refract( -v, n, 1.0 / material.ior );
    vec3 exitNormal;
    float pathLength = acrylicPathLength( pos, glassRay, n, modelMatrix, material.thickness, exitNormal );
    vec4 transmitted =`
	)
	.replace(
		'n, v, material.roughness, material.diffuseColor',
		'n, v, roughnessFactor, material.diffuseColor'
	)
	.replace('material.ior, material.thickness', 'material.ior, pathLength')
	.replace(
		'material.transmissionAlpha = mix',
		/* glsl */ `
    #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
    if ( acrylicShape == 0 ) {
      // Both surfaces of a polished acrylic sheet reflect. Account for the
      // second interface without whitening the center of the cover.
      float incidence = clamp( dot( n, v ), 0.0, 1.0 );
      float etaTerm = ( material.ior - 1.0 ) / ( material.ior + 1.0 );
      float f0 = etaTerm * etaTerm;
      float fresnel = f0 + ( 1.0 - f0 ) * pow( 1.0 - incidence, 5.0 );
      vec3 reflection = reflect( -v, n );
      vec3 studio = textureCubeUV( envMap, envMapRotation * reflection,
        clamp( 0.018 + geometryRoughness * 0.35, 0.018, 0.17 ) ).rgb * envMapIntensity;
      transmitted.rgb = mix( transmitted.rgb, ( 1.0 - fresnel ) * studio,
        fresnel / ( 1.0 + fresnel ) );
    } else {
      // Approximate the internal bounce near an edge once the next surface
      // reaches the critical angle. This keeps the face clear head-on.
      float critical = sqrt( 1.0 - 1.0 / ( material.ior * material.ior ) );
      float grazing = 1.0 - smoothstep( critical - 0.07, critical + 0.05, dot( glassRay, exitNormal ) );
      vec3 bounce = reflect( glassRay, exitNormal );
      float studioRadius = 8.0 * length( modelMatrix[1].xyz );
      vec3 studioRay = normalize( studioRadius * bounce + pos - modelMatrix[3].xyz );
      vec3 reflected = textureCubeUV( envMap, envMapRotation * studioRay, 0.045 ).rgb * envMapIntensity;
      transmitted.rgb = mix( transmitted.rgb, reflected, 0.46 * grazing );
    }
    #endif
    material.transmissionAlpha = mix`
	);

const disableCoverPass = { map: { value: null }, mix: { value: 0 } };

export function sharpenAcrylicTransmission(root, coverPass = disableCoverPass) {
	const configured = new Set();
	root.traverse((object) => {
		if (!object.isMesh) return;
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		for (const material of materials) {
			if (!(material.transmission > 0.99) || configured.has(material)) continue;
			configured.add(material);
			const volumes = { SquareEdgeAcrylicPlinth: 1, TwentyMillimetreAcrylicPlatter: 2 };
			const shape = volumes[object.name] ?? 0;
			const cover = object.name === 'ContinuousAcrylicDustCover' ? coverPass : disableCoverPass;
			object.geometry.computeBoundingBox();
			const halfSize = object.geometry.boundingBox.getSize(new Vector3()).multiplyScalar(0.5);

			const compile = material.onBeforeCompile;
			const programKey = material.customProgramCacheKey();
			material.onBeforeCompile = function (shader, renderer) {
				compile.call(this, shader, renderer);
				shader.uniforms.acrylicShape = { value: shape };
				shader.uniforms.acrylicHalfSize = { value: halfSize };
				shader.uniforms.acrylicUnderCover = cover.map;
				shader.uniforms.acrylicCoverMix = cover.mix;
				shader.fragmentShader = shader.fragmentShader
					.replace('#include <transmission_pars_fragment>', transmissionFunctions)
					.replace('#include <transmission_fragment>', transmission);
			};
			material.customProgramCacheKey = () => `${programKey}|acrylic-plate-optics-r167-v2`;
			material.needsUpdate = true;
		}
	});
}

// A second view of the deck is needed when the cover lies in front of it.
// The texture contains the plinth and platter, which are absent from Three's
// standard opaque-only transmission buffer. Allocate it only when it is seen.
export function createAcrylicRenderPass(renderer, modelRoot) {
	const cover = modelRoot.getObjectByName('ContinuousAcrylicDustCover');
	const pivot = modelRoot.getObjectByName('DustCover');
	const sample = { map: { value: null }, mix: { value: 0 } };
	const drawingSize = new Vector2();
	const cameraInModel = new Vector3();
	let underCover = null;
	sharpenAcrylicTransmission(modelRoot, sample);

	function render(scene, camera, explosion = 0) {
		const output = renderer.getRenderTarget();
		sample.mix.value = 0;

		if (cover?.visible && pivot && !output && !renderer.xr.isPresenting) {
			camera.getWorldPosition(cameraInModel);
			modelRoot.worldToLocal(cameraInModel);
			const heading =
				-cameraInModel.z / Math.max(0.001, Math.hypot(cameraInModel.x, cameraInModel.z));
			const rear = MathUtils.smoothstep(heading, 0.04, 0.44);
			const shut = 1 - MathUtils.smoothstep(Math.abs(pivot.rotation.x), 0.62, 0.88);
			const overlap = Math.max(rear, shut) * (1 - MathUtils.smoothstep(explosion, 0.26, 0.58));

			if (overlap > 0.005) {
				if (!underCover) {
					const useHalfFloat =
						renderer.extensions.has('EXT_color_buffer_half_float') ||
						renderer.extensions.has('EXT_color_buffer_float');
					underCover = new WebGLRenderTarget(1, 1, {
						type: useHalfFloat ? HalfFloatType : UnsignedByteType,
						colorSpace: LinearSRGBColorSpace,
						minFilter: LinearFilter,
						magFilter: LinearFilter,
						depthBuffer: true
					});
					underCover.texture.name = 'Deck beneath acrylic cover';
				}
				renderer.getDrawingBufferSize(drawingSize);
				const sizeScale = Math.min(1, 1800 / Math.max(1, drawingSize.x, drawingSize.y));
				underCover.setSize(
					Math.max(1, Math.round(drawingSize.x * sizeScale)),
					Math.max(1, Math.round(drawingSize.y * sizeScale))
				);

				cover.visible = false;
				try {
					renderer.setRenderTarget(underCover);
					renderer.clear();
					renderer.render(scene, camera);
				} finally {
					cover.visible = true;
					renderer.setRenderTarget(output);
				}
				sample.map.value = underCover.texture;
				sample.mix.value = overlap;
			}
		}

		const shadowUpdates = renderer.shadowMap.autoUpdate;
		if (sample.mix.value > 0) renderer.shadowMap.autoUpdate = false;
		try {
			renderer.render(scene, camera);
		} finally {
			renderer.shadowMap.autoUpdate = shadowUpdates;
		}
	}

	return {
		render,
		dispose() {
			underCover?.dispose();
		}
	};
}
