import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
	createPlaybackMotion,
	CUE_LEVER_UP,
	CUE_UP,
	OUTER_GROOVE,
	placeAntiSkateLine,
	RECORD_ENTRY,
	trackTonearm
} from './playback-motion.js';

// The preview renders the actual downloadable GLB, including its embedded maps.
export async function loadTurntable(source, { displayScale } = {}) {
	const loader = new GLTFLoader();
	const gltf =
		source instanceof ArrayBuffer
			? await loader.parseAsync(source, '')
			: await loader.loadAsync(source);
	const root = gltf.scene;
	const parts = {};
	const moving = [];
	const glassMaterials = new Set();
	root.traverse((object) => {
		if (object.name) parts[object.name] = object;
		const poses = object.userData.poses;
		if (poses) {
			moving.push({
				object,
				home: new T.Vector3(...poses.assembled),
				away: new T.Vector3(...poses.exploded)
			});
		}
		if (object.isMesh) {
			const materials = Array.isArray(object.material) ? object.material : [object.material];
			const glass = materials.filter((material) => material.transmission > 0.1);
			glass.forEach((material) => glassMaterials.add(material));
			object.castShadow = glass.length === 0;
			object.receiveShadow = glass.length === 0;
		}
	});
	// The GLB batches both center-label inscriptions into this mesh.
	const labelLettering = parts.Record_Hardware_2;
	if (labelLettering) labelLettering.visible = false;

	if (displayScale !== undefined) {
		const metreAsset = parts.AT_LPA2_ChromeEdition.userData.units === 'metres';
		const factor = displayScale * (metreAsset ? 1 : 0.1);
		root.scale.multiplyScalar(factor);
		for (const material of glassMaterials) material.attenuationDistance *= factor;
	}
	const {
		AntiSkateLine: line,
		CueLeverPivot: lever,
		DustCover: cover,
		Platter: platter,
		Record: record,
		Spindle: spindle,
		StylusTip: stylus,
		TonearmPivot: arm
	} = parts;
	const ring = line && new T.Vector3(...line.userData.antiSkateLine.ring);
	const yawAtRadius = trackTonearm(arm, stylus, spindle);

	function applyPose(explosion, recordX, recordY, armYaw, armPitch, coverOpen, cueLever) {
		const e = T.MathUtils.clamp(explosion, 0, 1);
		const t = e * e * (3 - 2 * e);
		for (const pose of moving) pose.object.position.lerpVectors(pose.home, pose.away, t);
		cover.rotation.x = -1.14 * (1 - t) * coverOpen;
		record.position.x += recordX;
		record.position.y += recordY;
		arm.rotation.set(armPitch, armYaw, 0, 'YXZ');
		if (lever) lever.rotation.x = cueLever;
		if (line) placeAntiSkateLine(line, arm, ring);
	}

	function setPose(explosion = 0, insert = 1, play = 1) {
		const e = T.MathUtils.clamp(explosion, 0, 1);
		const compact = 1 - e * e * (3 - 2 * e);
		applyPose(
			e,
			(1 - insert) * RECORD_ENTRY.x,
			(1 - insert) * RECORD_ENTRY.y,
			yawAtRadius(OUTER_GROOVE) * compact * play,
			CUE_UP * (1 - compact * play),
			1,
			CUE_LEVER_UP * (1 - compact * play)
		);
	}

	function applyMotion(state) {
		applyPose(
			state.explosion,
			state.recordX,
			state.recordY,
			state.armYaw,
			state.armPitch,
			state.cover,
			state.cueLever
		);
		record.visible = state.showRecord;
		record.rotation.y = state.rotation;
		platter.rotation.y = state.rotation;
	}

	return {
		root,
		parts,
		setPose,
		applyMotion,
		playback: createPlaybackMotion(yawAtRadius),
		animations: gltf.animations,
		materials: { label: parts.RecordLabel.material }
	};
}
