import * as THREE from 'three';
import { Effect } from 'postprocessing';

export class RippleEffect extends Effect {
	constructor(options = {}) {
		super('RippleEffect', fragment, {
			uniforms: new Map([
				['uTexture', new THREE.Uniform(options.texture)],
				['uScrollFlip', new THREE.Uniform(0.0)],
				['uTime', new THREE.Uniform(0.0)],
				['uPlayIntensity', new THREE.Uniform(0.0)]
			])
		});
	}
}
export default RippleEffect;

const fragment = `

uniform sampler2D uTexture;
uniform float uScrollFlip;
uniform float uTime;
uniform float uPlayIntensity;

// Layered sine turbulence — each layer moves at a different speed and angle
vec2 turbulence(vec2 uv, float t, float strength) {
    vec2 d = vec2(0.0);

    d.x += sin(uv.y * 3.1 + t * 0.51) * 0.018;
    d.x += sin(uv.y * 6.7 + t * 0.83 + 1.2) * 0.011;
    d.x += sin(uv.y * 11.3 + t * 0.37 + 2.8) * 0.007;
    d.x += sin(uv.x * 4.9 + t * 0.62) * 0.009;

    d.y += sin(uv.x * 2.9 + t * 0.44) * 0.014;
    d.y += sin(uv.x * 7.1 + t * 0.71 + 0.9) * 0.009;
    d.y += sin(uv.x * 13.7 + t * 0.29 + 3.5) * 0.005;
    d.y += sin(uv.y * 5.3 + t * 0.58) * 0.008;

    return d * strength;
}

void mainUv(inout vec2 uv) {
    float t = uTime;
    float p = uPlayIntensity; // 0.4 baseline, up to 1.0 on beats

    // Layer 1 — slow base drift, always on
    vec2 base = turbulence(uv, t * 0.9, 1.0);
    uv += base;

    // Layer 2 — mid-frequency, scales with play intensity
    vec2 mid = turbulence(uv, t * 1.1 + 5.0, p * 1.8);
    uv += mid;

    // Layer 3 — fast sharp ripples on strong beats
    float beatPulse = max(0.0, (p - 0.6) * 2.5); // only above 60% intensity
    vec2 sharp = turbulence(uv, t * 2.3 + 11.0, beatPulse * 1.2);
    uv += sharp;

    // Slow large-scale swirl — rotates the whole image gently
    float swirlAngle = sin(t * 0.18) * 0.9 * p;
    float cs = cos(swirlAngle);
    float sn = sin(swirlAngle);
    vec2 centered = uv - 0.5;
    uv = vec2(cs * centered.x - sn * centered.y, sn * centered.x + cs * centered.y) + 0.5;

    // Scroll smear — peaks at vertical center
    float belly = sin(uv.y * PI);
    uv.x += belly * uScrollFlip * 0.9;
    uv.y += belly * abs(uScrollFlip) * 0.12;
    uv.y += sin(uv.x * PI * 1.5 + t * 0.4) * abs(uScrollFlip) * 0.08;

    // Audio texture ripple
    vec4 tex = texture2D(uTexture, uv);
    float vx = -(tex.r * 2. - 1.);
    float vy = -(tex.g * 2. - 1.);
    float intensity = tex.b;
    uv.x += vx * intensity * 0.25;
    uv.y += vy * intensity * 0.25;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 uv2 = vec2(uv.x, 1.0 - uv.y);
    vec4 flipped = texture2D(inputBuffer, uv2);
    float blend = smoothstep(0.0, 0.25, abs(uScrollFlip));
    outputColor = mix(inputColor, flipped, blend * 0.65);
}

`;
