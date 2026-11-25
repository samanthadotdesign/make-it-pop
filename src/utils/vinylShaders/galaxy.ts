// @ts-nocheck

// Property metadata is only used in Figma Design, so this is a no-op.
function defineProperties(
  _component: unknown,
  _properties: unknown,
): void {}

export default function Effect() { }
export function setup(device, frame) {
    var wgsl = `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsData: vec4f,
  starDensity: vec4f,
  gradientStart: vec4f,
  gradientEnd: vec4f,
  nebulaColor: vec4f,
  galaxyRotation: vec4f,
  starSize: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn hash2(p: vec2f) -> f32 {

  var q = p;

  q = vec2f(dot(q, vec2f(127.1, 311.7)), dot(q, vec2f(269.5, 183.3)));

  return fract(sin(dot(q, vec2f(1.0))) * 43758.5453);

}

fn hash3(p: vec2f) -> vec3f {

  return vec3f(

    fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453),

    fract(sin(dot(p, vec2f(269.5, 183.3))) * 22578.1459),

    fract(sin(dot(p, vec2f(419.2, 371.9))) * 31241.9871)

  );

}

fn noise2(p: vec2f) -> f32 {

  let i = floor(p);

  let f = fract(p);

  let u = f * f * (3.0 - 2.0 * f);

  let a = hash2(i + vec2f(0.0, 0.0));

  let b = hash2(i + vec2f(1.0, 0.0));

  let c = hash2(i + vec2f(0.0, 1.0));

  let d = hash2(i + vec2f(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);

}

fn fbm(p: vec2f) -> f32 {

  var v = 0.0;

  var amp = 0.5;

  var freq = 1.0;

  var pp = p;

  for (var i = 0; i < 5; i++) {

    v += amp * noise2(pp * freq);

    freq *= 2.0;

    amp *= 0.5;

  }

  return v;

}

fn spiralArms(p: vec2f, rotRad: f32) -> f32 {

  let r = length(p);

  if (r < 0.001) { return 1.0; }

  let angle = atan2(p.y, p.x);

  let arms = 2.0;

  let tightness = 3.5;

  let a1 = angle - tightness * log(max(r, 0.001)) - rotRad;

  let wave = 0.5 + 0.5 * cos(arms * a1);

  let falloff = exp(-r * 2.5);

  return wave * falloff;

}

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let outputUv = outputUv_in;
  let dims = max(u.frameData.xy, vec2f(1.0));
  let inputDims = max(u.inputDimsData.xy, vec2f(1.0));
  let inputTexel = vec2f(1.0) / inputDims;
  let uv = outputUv;
  // texel and aspect are input-relative to match uv. Zoom fills rescale texel
  // alongside their uv redefinition below (see zoomLocal).
  let texel = inputTexel;
  let aspect = inputDims.x / max(inputDims.y, 1.0);
  let starDensity = u.starDensity.x;
  let gradientStart = u.gradientStart;
  let gradientEnd = u.gradientEnd;
  let nebulaColor = u.nebulaColor;
  let galaxyRotation = u.galaxyRotation.x;
  let starSize = u.starSize.x;
  // Work in pixel space for aspect-correct math
  let px = uv * dims;
  let center = dims * 0.5;
  let p = (px - center) / min(dims.x, dims.y);
  // Rotate the sampling space coherently so stars and clouds actually orbit.
  // The aspect-correct transform is identity at time/speed zero.
  let orbitAngle = u.frameData.z;
  let orbitCos = cos(orbitAngle);
  let orbitSin = sin(orbitAngle);
  let orbitP = vec2f(orbitCos * p.x + orbitSin * p.y,
                    -orbitSin * p.x + orbitCos * p.y);
  // Radial gradient blend for background
  let dist = length(p);
  let gradT = clamp(dist * 1.4, 0.0, 1.0);
  let bgColor = mix(gradientStart.rgb, gradientEnd.rgb, gradT);
  // Spiral arm structure
  let rotRad = galaxyRotation * 3.14159265 / 180.0;
  let spiral = spiralArms(orbitP, rotRad);
  // Nebula clouds using fbm
  let nebulaUv = orbitP * 2.3 + vec2f(0.4, 0.7);
  let nebulaVal = fbm(nebulaUv);
  let nebulaStrength = smoothstep(0.3, 0.8, nebulaVal) * spiral * 0.6;
  let nebulaContrib = nebulaColor.rgb * nebulaStrength;
  // Stars: tile the uv space into cells
  let densityThreshold = mix(0.92, 0.72, starDensity);
  let cellScale = 80.0;
  let orbitUv = (orbitP * min(dims.x, dims.y) + center) / dims;
  let starUv = orbitUv * cellScale;
  let cellId = floor(starUv);
  let cellUv = fract(starUv);
  var starColor = vec3f(0.0);
  // Check 3x3 neighborhood for star glows
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let neighbor = cellId + vec2f(f32(dx), f32(dy));
      let h = hash3(neighbor);
      if (h.x > densityThreshold) {
        // Star position within cell
        let starPos = h.yz;
        let d = length(cellUv - starPos - vec2f(f32(dx), f32(dy)));
        // Star brightness based on hash
        let brightness = (h.x - densityThreshold) / (1.0 - densityThreshold);
        let maxRadius = mix(0.002, 0.2, starSize);
        let size = mix(maxRadius * 0.4, maxRadius, brightness);
        let glow = exp(-d * d / (size * size)) * (0.5 + 0.5 * brightness);
        // Star color: mostly white with slight tint variation
        let starTint = vec3f(
          0.9 + h.x * 0.1,
          0.9 + h.y * 0.1,
          1.0
        );
        starColor = starColor + starTint * glow;
      }
    }
  }
  // Core glow at galaxy center
  let coreGlow = exp(-dist * dist / 0.02) * 0.8;
  let coreColor = mix(nebulaColor.rgb, vec3f(1.0, 0.95, 0.8), 0.5) * coreGlow;
  // Composite
  var finalColor = bgColor + nebulaContrib + starColor + coreColor;
  finalColor = clamp(finalColor, vec3f(0.0), vec3f(1.0));
  return vec4f(finalColor, 1.0);
}
`;
    frame.state.module = device.createShaderModule({ code: wgsl });
    frame.state.pipeline = null;
    frame.state.pipelineFormat = null;
    frame.state.quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ]);
    frame.state.quad.unmap();
    frame.state.uniformBuf = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
export function render(device, frame) {
    var params = frame.params || {};
    function finiteNumber(value, fallback) {
        var num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }
    function numberParam(name, fallback) {
        return finiteNumber(params[name], fallback);
    }
    function boolParam(name, fallback) {
        if (typeof params[name] === 'boolean')
            return params[name] ? 1 : 0;
        return fallback ? 1 : 0;
    }
    function selectParam(name, count, fallbackIndex) {
        // A select is a numeric dropdown: params[name] is the chosen option's index.
        var index = Math.round(Number(params[name]));
        return Number.isFinite(index) && index >= 0 && index < count ? index : fallbackIndex;
    }
    function colorParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.r, fallback[0]),
            finiteNumber(value.g, fallback[1]),
            finiteNumber(value.b, fallback[2]),
            finiteNumber(value.a, fallback[3]),
        ];
    }
    function pointParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
        ];
    }
    function pointRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
        ];
    }
    function pointPointLineParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.x2, fallback[2]),
            finiteNumber(value.y2, fallback[3]),
        ];
    }
    function pointAngleRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
            finiteNumber(value.angle, fallback[3]),
        ];
    }
    function colorPointParam(name, fallback) {
        var value = params[name] || {};
        var color = value.color || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            0,
            0,
            finiteNumber(color.r, fallback[2]),
            finiteNumber(color.g, fallback[3]),
            finiteNumber(color.b, fallback[4]),
            finiteNumber(color.a, fallback[5]),
        ];
    }
    function gradientParam(name, fallback) {
        var value = params[name] || {};
        var stops = Array.isArray(value.stops) && value.stops.length > 0 ? value.stops : fallback;
        // Layout: 8 stop colors (rgba), then 8 positions packed 4-per-vec4, then the live count.
        var out = new Array(44).fill(0);
        var count = Math.min(stops.length, 8);
        for (var i = 0; i < count; i++) {
            var stop = stops[i] || {};
            var color = stop.color || {};
            out[i * 4] = finiteNumber(color.r, 0);
            out[i * 4 + 1] = finiteNumber(color.g, 0);
            out[i * 4 + 2] = finiteNumber(color.b, 0);
            out[i * 4 + 3] = finiteNumber(color.a, 1);
            out[32 + i] = finiteNumber(stop.position, 0);
        }
        out[40] = count;
        return out;
    }
    var output = frame.output || {};
    var width = Math.max(1, finiteNumber(output.width, 1));
    var height = Math.max(1, finiteNumber(output.height, 1));
    var inputWidth = width;
    var inputHeight = height;
    device.queue.writeBuffer(frame.state.uniformBuf, 0, new Float32Array([
        width, height, finiteNumber(frame.time, 0) * 0.001 * Math.max(0, numberParam("movementSpeed", 1)) * 0.035, 0,
        inputWidth, inputHeight, 0, 0,
        numberParam("starDensity", 0.5), 0, 0, 0,
        ...colorParam("gradientStart", [0.039, 0.039, 0.18, 1]),
        ...colorParam("gradientEnd", [0, 0, 0.02, 1]),
        ...colorParam("nebulaColor", [0.29, 0.1, 0.478, 1]),
        numberParam("galaxyRotation", 0), 0, 0, 0,
        numberParam("starSize", 0.3), 0, 0, 0,
    ]));
    var outputFormat = frame.output.format;
    if (frame.state.pipeline == null || frame.state.pipelineFormat !== outputFormat) {
        frame.state.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: frame.state.module,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 16,
                        attributes: [
                            { shaderLocation: 0, format: 'float32x2', offset: 0 },
                            { shaderLocation: 1, format: 'float32x2', offset: 8 },
                        ],
                    }],
            },
            fragment: {
                module: frame.state.module,
                entryPoint: 'fs_main',
                targets: [{ format: outputFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });
        frame.state.pipelineFormat = outputFormat;
    }
    var bindGroup = device.createBindGroup({
        layout: frame.state.pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: frame.state.uniformBuf } },
        ],
    });
    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: frame.output.createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store',
            }],
    });
    pass.setPipeline(frame.state.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, frame.state.quad);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
defineProperties(Effect, {
    "movementSpeed": {
        type: "number",
        label: "Movement Speed",
        defaultValue: 1,
        control: "slider",
        min: 0,
        max: 3,
        step: 0.05,
    },
    "starDensity": {
        type: "number",
        label: "Star Density",
        defaultValue: 0.5,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "gradientStart": {
        type: "color",
        label: "Gradient Start",
        defaultValue: { "r": 0.039, "g": 0.039, "b": 0.18, "a": 1 },
    },
    "gradientEnd": {
        type: "color",
        label: "Gradient End",
        defaultValue: { "r": 0, "g": 0, "b": 0.02, "a": 1 },
    },
    "nebulaColor": {
        type: "color",
        label: "Nebula Color",
        defaultValue: { "r": 0.29, "g": 0.1, "b": 0.478, "a": 1 },
    },
    "galaxyRotation": {
        type: "number",
        label: "Galaxy Rotation",
        defaultValue: 0,
        control: "slider",
        min: 0,
        max: 360,
        step: 1,
    },
    "starSize": {
        type: "number",
        label: "Star Size",
        defaultValue: 0.3,
        control: "slider",
        min: 0,
        max: 5,
        step: 0.1,
    },
});

export const manifest = {
  "version": 3,
  "name": "Galaxy",
  "isAnimated": true,
  "usesMouse": false
}
