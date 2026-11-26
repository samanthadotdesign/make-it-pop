function artworkPoint(matrix, x, y) {
	// Undo the combined tilt, perspective, and spin on the plane of the record.
	const a = matrix.m11 - x * matrix.m14;
	const b = matrix.m21 - x * matrix.m24;
	const c = matrix.m12 - y * matrix.m14;
	const d = matrix.m22 - y * matrix.m24;
	const e = x * matrix.m44 - matrix.m41;
	const f = y * matrix.m44 - matrix.m42;
	const determinant = a * d - b * c;
	return [(e * d - b * f) / determinant, (a * f - e * c) / determinant];
}

export function followVinylShadow(controls, options) {
	const title = controls.querySelector('p');
	const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const points = [0.2, 0.5, 0.8];
	let samples;
	let timer;

	function sample() {
		const { canvas } = options;
		const rotor = canvas.closest('.rotor');
		const disc = rotor?.closest('.disc');
		if (!disc || !canvas.clientWidth || !canvas.clientHeight) return;

		const titleBounds = title.getBoundingClientRect();
		if (!titleBounds.width) return;
		const slot = disc.parentElement.getBoundingClientRect();
		const style = getComputedStyle(disc);
		const originX = slot.left + parseFloat(style.left) + parseFloat(style.width) / 2;
		const originY = slot.top + parseFloat(style.top) + parseFloat(style.height) / 2;
		const rotorStyle = getComputedStyle(rotor);
		const width = parseFloat(rotorStyle.width);
		const height = parseFloat(rotorStyle.height);
		const spin = rotorStyle.transform;
		const matrix = new DOMMatrixReadOnly(style.transform).multiply(
			spin === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(spin)
		);

		// Read only three small swatches and keep the artwork canvas on its original rendering path.
		if (!samples) {
			const scratch = document.createElement('canvas');
			scratch.width = points.length;
			scratch.height = 1;
			samples = scratch.getContext('2d', { willReadFrequently: true });
		}
		if (!samples) return;
		samples.clearRect(0, 0, points.length, 1);
		for (const [index, fraction] of points.entries()) {
			const [x, y] = artworkPoint(
				matrix,
				titleBounds.left + titleBounds.width * fraction - originX,
				titleBounds.top + titleBounds.height / 2 - originY
			);
			const u = x / width + 0.5;
			const v = y / height + 0.5;
			if ((2 * u - 1) ** 2 + (2 * v - 1) ** 2 >= 1) continue;
			samples.drawImage(
				canvas,
				Math.max(0, Math.min(canvas.width - 3, Math.round(u * canvas.width) - 1)),
				Math.max(0, Math.min(canvas.height - 3, Math.round(v * canvas.height) - 1)),
				3,
				3,
				index,
				0,
				1,
				1
			);
		}

		const { data } = samples.getImageData(0, 0, points.length, 1);
		let count = 0;
		let red = 0;
		let green = 0;
		let blue = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] < 128) continue;
			red += data[i];
			green += data[i + 1];
			blue += data[i + 2];
			count += 1;
		}
		if (count) {
			const channels = [red, green, blue].map((channel) => Math.round(channel / count));
			controls.style.setProperty('--vinyl-shadow-sample', `rgb(${channels.join(' ')})`);
		}
	}

	function refresh() {
		if (options.desktop && options.canvas && !document.hidden) sample();
	}

	function schedule() {
		clearInterval(timer);
		refresh();
		if (options.desktop && options.canvas && !document.hidden && !motion.matches) {
			timer = setInterval(refresh, 140);
		}
	}

	document.addEventListener('visibilitychange', schedule);
	motion.addEventListener('change', schedule);
	window.addEventListener('resize', refresh);
	schedule();

	return {
		update(next) {
			if (next.canvas === options.canvas && next.desktop === options.desktop) return;
			options = next;
			controls.style.removeProperty('--vinyl-shadow-sample');
			schedule();
		},
		destroy() {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', schedule);
			motion.removeEventListener('change', schedule);
			window.removeEventListener('resize', refresh);
		}
	};
}
