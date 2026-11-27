<script>
	import { base } from '$app/paths';
	import VinylShader from './VinylShader.svelte';

	export let record;
	export let spinning = false;
	export let smoothSpin = false;
	export let reducedMotion = false;
	export let animate = true;
	export let beveled = false;

	const waterMotion = { from: 0, to: 2, durationMs: 2000, loopMode: 'boomerang' };
	const assetRoot = `${base}/images/shelf`;

	function spinRecord(node, initialOptions) {
		let rotation;
		let frame;
		let rate = 0;

		function update({ spinning, smoothSpin, reducedMotion }) {
			cancelAnimationFrame(frame);
			if (reducedMotion) {
				rotation?.cancel();
				rotation = undefined;
				rate = 0;
				return;
			}
			if (!rotation && !spinning) return;
			if (!rotation) {
				rotation = node.animate(
					[{ transform: 'rotateZ(0turn)' }, { transform: 'rotateZ(1turn)' }],
					{ duration: 12000, iterations: Infinity }
				);
				rotation.playbackRate = 0;
			}

			const targetRate = spinning ? 1 : 0;
			if (!smoothSpin || rate === targetRate) {
				rate = targetRate;
				rotation.updatePlaybackRate(rate);
				if (spinning) rotation.play();
				else rotation.pause();
				return;
			}

			const startRate = rate;
			const start = performance.now();
			const duration = 440 * Math.abs(targetRate - startRate);
			if (spinning) rotation.play();

			function ramp(now) {
				const t = Math.max(0, Math.min(1, (now - start) / duration));
				const eased = t * t * (3 - 2 * t);
				rate = startRate + (targetRate - startRate) * eased;
				// Change speed while keeping the record at its current angle.
				rotation.updatePlaybackRate(rate);
				if (t < 1) frame = requestAnimationFrame(ramp);
				else if (!spinning) rotation.pause();
			}

			frame = requestAnimationFrame(ramp);
		}

		update(initialOptions);
		return {
			update,
			destroy() {
				cancelAnimationFrame(frame);
				rotation?.cancel();
			}
		};
	}
</script>

<div
	class="record"
	class:beveled
	class:dusk={record.finish === 'dusk'}
	aria-hidden="true"
	style="--pressing: {record.color ?? record.tint}"
>
	{#if beveled}
		<span class="rim" style="--rim-color: {record.treatment?.color ?? record.color ?? record.tint}">
			<span class="rim-side" />
		</span>
	{/if}

	<div class="face">
		<div class="rotor" class:spinning use:spinRecord={{ spinning, smoothSpin, reducedMotion }}>
			{#if record.treatment}
				<div class="shader" style="--pressing: {record.treatment.color}">
					<VinylShader
						kind={record.treatment.kind}
						properties={record.treatment.properties}
						{animate}
						playheadTimeline={record.finish === 'water' ? waterMotion : null}
						on:surface
					/>
				</div>
				<img class="grooves" src="{assetRoot}/{record.finish}-grooves.svg" alt="" />
				<span
					class="label"
					style:background-color={record.finish === 'water'
						? 'rgb(255 255 255 / 0.5)'
						: record.treatment.label}
				/>
			{:else}
				<div class="pressing">
					<span class="label plain-label" />
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.record,
	.face,
	.rotor,
	.pressing,
	.shader,
	.rim {
		position: absolute;
		inset: 0;
	}

	.record {
		pointer-events: none;
	}

	.dusk {
		inset: 3%;
	}

	.beveled,
	.rim {
		transform-style: preserve-3d;
	}

	.rim {
		/* The playable model's pressing is 0.0225 units thick and 3.003 units across. */
		--rim-depth: calc(var(--size) * 0.0075);
		--rim-light: color-mix(in srgb, var(--rim-color) 84%, white);
		--rim-shade: color-mix(in srgb, var(--rim-color) 80%, #17151d);
	}

	.rim::before,
	.rim-side,
	.rim::after {
		content: '';
		position: absolute;
		inset: 0;
		mask: radial-gradient(
			circle closest-side,
			transparent 2.3%,
			#000 2.5% 99.65%,
			transparent 100%
		);
	}

	.rim::before {
		background: var(--rim-light);
		transform: translateZ(calc(var(--rim-depth) * -0.3)) scale(0.998);
	}

	.rim-side {
		background: var(--rim-color);
		transform: translateZ(calc(var(--rim-depth) * -0.65)) scale(0.997);
	}

	.rim::after {
		background: var(--rim-shade);
		transform: translateZ(calc(-1 * var(--rim-depth))) scale(0.992);
	}

	.face {
		/* The rim and spindle hole share a fixed center with the rotating artwork. */
		mask: radial-gradient(
			circle closest-side,
			transparent 2.2%,
			#000 2.45% 99.6%,
			transparent 100%
		);
	}

	.rotor {
		transform-origin: 50% 50%;
	}

	.spinning {
		will-change: transform;
	}

	.shader {
		background-color: var(--pressing);
	}

	.grooves,
	.label {
		position: absolute;
		display: block;
	}

	.grooves {
		inset: 0.33%;
		width: 99.34%;
		height: 99.34%;
	}

	.label {
		inset: 33.34%;
		border-radius: 50%;
	}

	.pressing {
		background: repeating-radial-gradient(circle, transparent 0 3px, #1111 3.5px 4px),
			var(--pressing);
	}

	.plain-label {
		background: color-mix(in srgb, var(--pressing) 30%, #f2ede3);
	}

	@media (prefers-reduced-motion: reduce) {
		.rotor {
			will-change: auto;
		}
	}
</style>
