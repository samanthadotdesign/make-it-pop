export const vertexShader = `#version 300 es
out vec2 uv;

void main() {
	vec2 point = vec2(
		gl_VertexID == 1 ? 3.0 : -1.0,
		gl_VertexID == 2 ? 3.0 : -1.0
	);
	gl_Position = vec4(point, 0.0, 1.0);
	uv = vec2((point.x + 1.0) * 0.5, (1.0 - point.y) * 0.5);
}
`;

const header = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outputColor;
uniform vec2 resolution;
uniform float elapsed;
`;

// Galaxy v. c82137b from Figma. The authored WGSL equations are unchanged;
// only the language and the canvas/uniform interface differ on the web.
const galaxy = `${header}
uniform float movementSpeed;
uniform float starDensity;
uniform vec3 gradientStart;
uniform vec3 gradientEnd;
uniform vec3 nebulaColor;
uniform float galaxyRotation;
uniform float starSize;

float hash2(vec2 p) {
	vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return fract(sin(dot(q, vec2(1.0))) * 43758.5453);
}

vec3 hash3(vec2 p) {
	return vec3(
		fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
		fract(sin(dot(p, vec2(269.5, 183.3))) * 22578.1459),
		fract(sin(dot(p, vec2(419.2, 371.9))) * 31241.9871)
	);
}

float noise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash2(i);
	float b = hash2(i + vec2(1.0, 0.0));
	float c = hash2(i + vec2(0.0, 1.0));
	float d = hash2(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float amp = 0.5;
	float freq = 1.0;
	for (int i = 0; i < 5; i++) {
		v += amp * noise2(p * freq);
		freq *= 2.0;
		amp *= 0.5;
	}
	return v;
}

float spiralArms(vec2 p, float rotRad) {
	float r = length(p);
	if (r < 0.001) return 1.0;
	float angle = atan(p.y, p.x);
	float a1 = angle - 3.5 * log(max(r, 0.001)) - rotRad;
	float wave = 0.5 + 0.5 * cos(2.0 * a1);
	return wave * exp(-r * 2.5);
}

void main() {
	vec2 dims = max(resolution, vec2(1.0));
	float size = min(dims.x, dims.y);
	vec2 center = dims * 0.5;
	vec2 p = (uv * dims - center) / size;
	float orbitAngle = elapsed * max(0.0, movementSpeed) * 0.035;
	float orbitCos = cos(orbitAngle);
	float orbitSin = sin(orbitAngle);
	vec2 orbitP = vec2(orbitCos * p.x + orbitSin * p.y, -orbitSin * p.x + orbitCos * p.y);

	float dist = length(p);
	vec3 bgColor = mix(gradientStart, gradientEnd, clamp(dist * 1.4, 0.0, 1.0));
	float spiral = spiralArms(orbitP, radians(galaxyRotation));
	float nebulaVal = fbm(orbitP * 2.3 + vec2(0.4, 0.7));
	float nebulaStrength = smoothstep(0.3, 0.8, nebulaVal) * spiral * 0.6;
	vec3 nebulaContrib = nebulaColor * nebulaStrength;

	float densityThreshold = mix(0.92, 0.72, starDensity);
	vec2 starUv = (orbitP * size + center) / dims * 80.0;
	vec2 cellId = floor(starUv);
	vec2 cellUv = fract(starUv);
	vec3 starColor = vec3(0.0);
	for (int dy = -1; dy <= 1; dy++) {
		for (int dx = -1; dx <= 1; dx++) {
			vec2 offset = vec2(float(dx), float(dy));
			vec3 h = hash3(cellId + offset);
			if (h.x > densityThreshold) {
				float d = length(cellUv - h.yz - offset);
				float brightness = (h.x - densityThreshold) / (1.0 - densityThreshold);
				float maxRadius = mix(0.002, 0.2, starSize);
				float radius = mix(maxRadius * 0.4, maxRadius, brightness);
				float glow = exp(-d * d / (radius * radius)) * (0.5 + 0.5 * brightness);
				vec3 starTint = vec3(0.9 + h.x * 0.1, 0.9 + h.y * 0.1, 1.0);
				starColor += starTint * glow;
			}
		}
	}

	float coreGlow = exp(-dist * dist / 0.02) * 0.8;
	vec3 coreColor = mix(nebulaColor, vec3(1.0, 0.95, 0.8), 0.5) * coreGlow;
	outputColor = vec4(clamp(bgColor + nebulaContrib + starColor + coreColor, 0.0, 1.0), 1.0);
}
`;

// Browser fallback for the Figma mesh shader on devices without WebGPU.
const moving = `${header}
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform float twist;
uniform float morphSpeed;
uniform float rotationSpeed;

void main() {
	float phase = elapsed * morphSpeed * 0.23;
	float a = 0.25 * sin(elapsed * rotationSpeed * 0.035);
	vec2 p = uv - 0.5;
	vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * p + 0.5;
	float bend = sin((q.y - 0.33) * 3.5 + 0.18 * sin(phase));
	float projection = q.x + bend * twist + 0.075 * cos(q.y * 4.0 - phase);
	vec3 hue = mix(color1, color2, smoothstep(0.1, 0.68, projection));
	hue = mix(hue, color3, smoothstep(0.35, 1.14, projection));
	float lighting = 0.92 + 0.08 * cos((q.y - 0.5) * 2.8);
	outputColor = vec4(hue * lighting, 1.0);
}
`;

// Water caustic v. 8370 from Figma, with the fragment equations translated to GLSL.
const water = `${header}
uniform vec4 waterColor;
uniform vec4 highlightColor;
uniform float intensity;
uniform float playhead;
uniform float scale;
uniform vec2 center;

void main() {
	vec2 origin = center / 100.0;
	vec2 adjustedUv = (uv - origin) / scale + (1.0 - origin);
	const float tau = 6.28318530718;
	const int iterations = 5;
	float time = playhead * tau / 100.0 + 23.0;
	vec2 uvPx = adjustedUv * resolution / min(resolution.x, resolution.y);
	vec2 p = fract(uvPx) * tau - 250.0;
	vec2 i = p;
	float c = 1.0;
	float inten = mix(0.002519, 0.01178, intensity);
	for (int n = 0; n < iterations; n++) {
		float nt = time * float(n + 1);
		i = p + vec2(cos(nt - i.x) + sin(nt + i.y), sin(nt - i.y) + cos(nt + i.x));
		c += 1.0 / length(vec2(p.x / (sin(i.x + nt) / inten), p.y / (cos(i.y + nt) / inten)));
	}
	c /= float(iterations);
	c = 1.17 - pow(c, 1.4);
	float mask = clamp(pow(abs(c), 8.0), 0.0, 1.0);
	vec4 color = mix(waterColor, highlightColor, mask);
	outputColor = vec4(color.rgb * color.a, color.a);
}
`;

export const vinylShaders = { galaxy, moving, water };
