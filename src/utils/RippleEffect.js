import * as THREE from 'three';
import { Effect } from 'postprocessing';

export class RippleEffect extends Effect {
	constructor(options = {}) {
		super('RippleEffect', fragment, {
			uniforms: new Map([
				['uTexture', new THREE.Uniform(options.texture)],
				['uScrollVelocity', new THREE.Uniform(0.0)],
				['uTime', new THREE.Uniform(0.0)]
			])
		});
	}
}
export default RippleEffect;

const fragment = `

uniform sampler2D uTexture;
uniform float uScrollVelocity;
uniform float uTime;

void mainUv(inout vec2 uv) {
        // Always-on wave distortion — independent of audio data
        float wave = sin(uv.y * 8.0 + uTime * 0.5) * 0.06
                   + sin(uv.x * 6.0 + uTime * 0.3) * 0.05;
        uv.x += wave;
        uv.y += wave * 0.5;

        // Scroll-driven amplification
        float scrollWave = sin(uv.y * 5.0 + uTime) * uScrollVelocity * 0.5;
        uv.x += scrollWave;
        uv.y += scrollWave * 0.3;

        // Audio texture ripple on top (when data is present)
        vec4 tex = texture2D(uTexture, uv);
        float vx = -(tex.r * 2. - 1.);
        float vy = -(tex.g * 2. - 1.);
        float intensity = tex.b;
        uv.x += vx * intensity * 0.2;
        uv.y += vy * intensity * 0.2;
    }

`;
