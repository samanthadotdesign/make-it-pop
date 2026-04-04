import * as THREE from 'three';
import { Effect } from 'postprocessing';

export class RippleEffect extends Effect {
	constructor(options = {}) {
		super('RippleEffect', fragment, {
			uniforms: new Map([
				['uTexture', new THREE.Uniform(options.texture)],
				['uScrollVelocity', new THREE.Uniform(0.0)]
			])
		});
	}
}
export default RippleEffect;

const fragment = `

uniform sampler2D uTexture;
uniform float uScrollVelocity;

void mainUv(inout vec2 uv) {
        vec4 tex = texture2D(uTexture, uv);
        float vx = -(tex.r *2. - 1.);
        float vy = -(tex.g *2. - 1.);
        float intensity = tex.b;
        float distortion = 0.2 + uScrollVelocity * 0.8;
        uv.x += vx * distortion * intensity;
        uv.y += vy * distortion * intensity;
    }


`;
