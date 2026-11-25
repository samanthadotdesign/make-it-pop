const TAU = Math.PI * 2;
const SPIN_UP = 1.25;
const SPIN_DOWN = 0.85;
const COVER_TRAVEL = 0.72;
const DECK_TRAVEL = 1.05;
const RECORD_SLIDE = 0.83;
const RECORD_DROP = 0.26;
export const CUE_UP = -0.029;
export const CUE_LEVER_UP = -0.55;
export const PLAY_SECONDS = 120;

const smooth = (value) => value * value * (3 - 2 * value);
const mix = (from, to, fraction) => from + (to - from) * fraction;
const clamp = (value) => Math.min(Math.max(value, 0), 1);

// 33⅓ RPM is one revolution every 1.8 seconds.
export const REVOLUTION_SECONDS = 1.8;
export const RECORD_ENTRY = { x: -4.1, y: 0.22 };
export const OUTER_GROOVE = 1.44;
export const INNER_GROOVE = 0.67;

export function grooveTracking(pivotToSpindle, stylus) {
	const distance = Math.hypot(pivotToSpindle.x, pivotToSpindle.z);
	const reach = Math.hypot(stylus.x, stylus.z);
	const direction = Math.atan2(pivotToSpindle.x, pivotToSpindle.z);
	const stylusHeading = Math.atan2(stylus.x, stylus.z);
	return (radius) => {
		const cosine = (distance ** 2 + reach ** 2 - radius ** 2) / (2 * distance * reach);
		return direction + Math.acos(Math.min(1, Math.max(-1, cosine))) - stylusHeading;
	};
}

export function trackTonearm(arm, stylus, spindle) {
	const deck = spindle.parent;
	const pivot = deck.worldToLocal(arm.getWorldPosition(arm.position.clone()));
	const center = spindle.position.clone().sub(pivot);
	const tip = arm.worldToLocal(stylus.getWorldPosition(stylus.position.clone()));
	return grooveTracking(center, tip);
}

export function antiSkateLineTransform(rotation, pivot, ring, guide) {
	const segment = ring.clone().applyQuaternion(rotation).add(pivot).sub(guide);
	const up = ring.clone().set(0, 1, 0);
	return {
		quaternion: rotation.clone().setFromUnitVectors(up, segment.clone().normalize()),
		scale: segment.clone().set(1, segment.length(), 1)
	};
}

export function placeAntiSkateLine(link, arm, ring) {
	const { quaternion, scale } = antiSkateLineTransform(
		arm.quaternion,
		arm.position,
		ring,
		link.position
	);
	link.quaternion.copy(quaternion);
	link.scale.copy(scale);
}

export function createPlaybackMotion(yawAtRadius) {
	const state = {
		mode: 'product',
		phase: 'product',
		wantsPlayback: false,
		stylusLanded: false,
		sequenceComplete: false,
		exchangeReady: false,
		explosion: 0,
		cover: 1,
		showRecord: false,
		recordX: 0,
		recordY: 0,
		armPitch: CUE_UP,
		armYaw: 0,
		cueLever: CUE_LEVER_UP,
		rotation: 0,
		speed: 0,
		groove: OUTER_GROOVE
	};
	let coverTarget = 1;
	let motorTarget = 0;
	let playTime = 0;
	let recordSeated = false;
	let jobs = [];
	let active;

	function switchMode(mode, wantsPlayback = false) {
		state.mode = mode;
		state.wantsPlayback = wantsPlayback;
		state.stylusLanded = false;
		state.sequenceComplete = false;
		state.exchangeReady = false;
		coverTarget = state.cover;
		jobs = [];
		active = undefined;
	}

	function transition(phase, duration, goal = {}, start) {
		jobs.push({ phase, duration, goal, start, elapsed: 0 });
	}

	function finish(phase, start) {
		transition(phase, 0, {}, start);
	}

	function raiseCue() {
		if (state.cueLever !== CUE_LEVER_UP) transition('cuelever', 0.18, { cueLever: CUE_LEVER_UP });
		if (state.armPitch !== CUE_UP) transition('lifting', 0.24, { armPitch: CUE_UP });
	}

	function parkArm() {
		raiseCue();
		if (state.armYaw !== 0) transition('parking', 0.45, { armYaw: 0 });
	}

	function stopMotor() {
		motorTarget = 0;
		if (state.speed > 0) transition('stopping', () => SPIN_DOWN * state.speed);
	}

	function moveCover(open) {
		const cover = open ? 1 : 0;
		transition(
			open ? 'opening' : 'closing',
			() => COVER_TRAVEL * Math.abs(cover - state.cover),
			{ cover },
			() => {
				coverTarget = cover;
			}
		);
	}

	function resetTracking() {
		playTime = 0;
		state.groove = OUTER_GROOVE;
	}

	function separateAndSeat() {
		moveCover(true);
		if (state.explosion !== 1) {
			transition('separating', DECK_TRAVEL, { explosion: 1 });
		}
		transition(
			'inserting',
			() => RECORD_SLIDE * Math.abs(state.recordX / RECORD_ENTRY.x),
			{ recordX: 0 },
			() => {
				if (state.showRecord) return;
				state.showRecord = true;
				state.recordX = RECORD_ENTRY.x;
				state.recordY = RECORD_ENTRY.y;
			}
		);
		transition('seating', () => RECORD_DROP * Math.abs(state.recordY / RECORD_ENTRY.y), {
			recordY: 0
		});
		finish('ready', () => {
			recordSeated = true;
		});
	}

	function showProduct() {
		switchMode('product');
		parkArm();
		stopMotor();
		finish('product', () => {
			state.showRecord = false;
			recordSeated = false;
			resetTracking();
		});
		if (state.explosion !== 0) transition('assembling', DECK_TRAVEL, { explosion: 0 });
		finish('product');
	}

	function showExploded(target = 1) {
		target = clamp(target);
		switchMode(target === 1 ? 'exploded' : 'separation');
		parkArm();
		stopMotor();
		moveCover(true);
		transition('separating', DECK_TRAVEL, { explosion: target, recordX: 0, recordY: 0 }, () => {
			state.showRecord = true;
		});
		finish('ready', () => {
			recordSeated = true;
		});
	}

	function scrubExplosion(target) {
		const value = clamp(target);
		if (
			state.armPitch !== CUE_UP ||
			state.cueLever !== CUE_LEVER_UP ||
			state.speed > 0 ||
			state.armYaw !== 0
		) {
			showExploded(value);
			return;
		}
		switchMode(value === 1 ? 'exploded' : 'separation');
		state.explosion = value;
		state.recordX = 0;
		state.recordY = 0;
		state.showRecord = true;
		state.phase = 'ready';
		motorTarget = 0;
		recordSeated = true;
	}

	function insertRecord() {
		switchMode('exploded');
		recordSeated = false;
		state.showRecord = false;
		resetTracking();
		parkArm();
		stopMotor();
		separateAndSeat();
	}

	function startPlayback({ fromExploded = false } = {}) {
		if (state.wantsPlayback) return;
		if (fromExploded && state.mode === 'product') state.explosion = 1;
		switchMode('playing', true);
		if (!recordSeated) {
			parkArm();
			stopMotor();
			separateAndSeat();
		} else {
			raiseCue();
			if (state.explosion !== 0) moveCover(true);
		}
		if (!recordSeated || state.explosion !== 0) {
			transition('assembling', DECK_TRAVEL, { explosion: 0 }, () => {
				motorTarget = 1;
			});
		}
		const yaw = yawAtRadius(state.groove);
		transition(
			'starting',
			() => SPIN_UP * (1 - state.speed),
			{},
			() => {
				motorTarget = 1;
			}
		);
		if (state.armYaw !== yaw) transition('cueing', 0.64, { armYaw: yaw });
		transition('cuelever', 0.18, { cueLever: 0 });
		transition('lowering', 0.58, { armPitch: 0 });
		finish('stylus-landed', () => {
			state.stylusLanded = true;
		});
		moveCover(false);
		finish('playing', () => {
			state.sequenceComplete = true;
		});
	}

	function pausePlayback() {
		if (!state.wantsPlayback) return;
		switchMode('paused');
		raiseCue();
		stopMotor();
		finish('paused');
	}

	function inspectPaused() {
		if (state.mode !== 'paused' || state.explosion === 1) return;
		switchMode('inspecting');
		raiseCue();
		stopMotor();
		moveCover(true);
		transition('separating', DECK_TRAVEL, { explosion: 1 });
		finish('paused', () => {
			state.mode = 'paused';
		});
	}

	function unloadPlayback() {
		if (state.mode === 'exchange') return;
		switchMode('exchange');
		parkArm();
		stopMotor();
		moveCover(true);
		if (state.explosion !== 1) transition('separating', DECK_TRAVEL, { explosion: 1 });
		if (state.showRecord)
			transition('removing', RECORD_SLIDE, {
				recordX: RECORD_ENTRY.x,
				recordY: RECORD_ENTRY.y
			});
		finish('exchange', () => {
			state.showRecord = false;
			state.exchangeReady = true;
			recordSeated = false;
			resetTracking();
		});
	}

	function advanceMotion(dt) {
		// Integrate a linear speed ramp for the portion of this frame spent
		// accelerating, then the final speed for any remainder.
		const ramp = motorTarget > state.speed ? SPIN_UP : SPIN_DOWN;
		const rampRemaining = Math.abs(motorTarget - state.speed) * ramp;
		const rampTime = Math.min(dt, rampRemaining);
		const speed =
			dt >= rampRemaining
				? motorTarget
				: state.speed + (Math.sign(motorTarget - state.speed) * rampTime) / ramp;
		const turn = ((state.speed + speed) * rampTime) / 2 + speed * (dt - rampTime);
		state.rotation = (state.rotation - (turn * TAU) / REVOLUTION_SECONDS) % TAU;
		state.speed = speed;
		state.cover = mix(coverTarget, state.cover, Math.exp(-6 * dt));
		if (state.stylusLanded) {
			playTime = Math.min(playTime + dt, PLAY_SECONDS);
			state.groove = mix(OUTER_GROOVE, INNER_GROOVE, playTime / PLAY_SECONDS);
			state.armYaw = yawAtRadius(state.groove);
		}
	}

	function update(dt) {
		let remaining = Math.max(0, dt);
		while (active || jobs.length) {
			if (!active) {
				active = jobs.shift();
				active.start?.();
				if (typeof active.duration === 'function') active.duration = active.duration();
				state.phase = active.phase;
				active.from = Object.fromEntries(Object.keys(active.goal).map((key) => [key, state[key]]));
			}
			const pending = active.duration - active.elapsed;
			const step = Math.min(remaining, pending);
			if (step > 0) advanceMotion(step);
			active.elapsed += step;
			const fraction = pending <= remaining ? 1 : smooth(active.elapsed / active.duration);
			for (const [key, to] of Object.entries(active.goal))
				state[key] = mix(active.from[key], to, fraction);
			remaining -= step;
			if (pending > step) return state;
			active = undefined;
		}
		if (remaining > 0) advanceMotion(remaining);
		return state;
	}

	return {
		state,
		update,
		showProduct,
		showExploded,
		scrubExplosion,
		insertRecord,
		startPlayback,
		pausePlayback,
		inspectPaused,
		unloadPlayback,
		setCover(open) {
			coverTarget = open ? 1 : 0;
		}
	};
}
