import * as THREE from 'three';
import { Effect } from 'postprocessing';

export class RippleEffect extends Effect {
	constructor(options = {}) {
		super('RippleEffect', fragment, {
			uniforms: new Map([
				['uTexture', new THREE.Uniform(options.texture)],
				['uScrollFlip', new THREE.Uniform(0.0)],
				['uTime', new THREE.Uniform(0.0)]
			])
		});
	}
}
export default RippleEffect;

const fragment = `

uniform sampler2D uTexture;
uniform float uScrollFlip;  // signed -1 to 1, driven by scroll velocity + direction
uniform float uTime;

void mainUv(inout vec2 uv) {
    // Ambient wave — always on, gentle
    float wave = sin(uv.y * 5.0 + uTime * 0.5) * 0.018
               + sin(uv.x * 4.0 + uTime * 0.35) * 0.012;
    uv.x += wave;
    uv.y += wave * 0.4;

    // Scroll smear — peaks at vertical center (sin(y*PI) = 0 at edges, 1 at middle)
    // Horizontal pull in scroll direction + slight vertical stretch
    float belly = sin(uv.y * PI);
    float smearX = belly * uScrollFlip * 0.9;
    float smearY = belly * abs(uScrollFlip) * 0.12;
    uv.x += smearX;
    uv.y += smearY;

    // Secondary ripple across horizontal axis for more fluid feel
    float ripple = sin(uv.x * PI * 1.5 + uTime * 0.4) * abs(uScrollFlip) * 0.08;
    uv.y += ripple;

    // Audio texture ripple on top
    vec4 tex = texture2D(uTexture, uv);
    float vx = -(tex.r * 2. - 1.);
    float vy = -(tex.g * 2. - 1.);
    float intensity = tex.b;
    uv.x += vx * intensity * 0.2;
    uv.y += vy * intensity * 0.2;
}

`;
