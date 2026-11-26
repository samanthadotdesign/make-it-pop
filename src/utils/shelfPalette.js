const pressingPalettes = new Map([
	['float', ['#b1acef', '#8e96c5', '#f5a4d5', '#fde2a2']],
	['galaxy', ['#9d93c1', '#858bb3', '#b787c9', '#8faff0']],
	['water', ['#acd8ee', '#799fc9', '#67c4e1', '#b3f4dd']],
	['dusk', ['#f3c2a0', '#b591aa', '#e78278', '#f8d391']]
]);

function mix(color, target, amount) {
	return color.map((channel, index) => channel + (target[index] - channel) * amount);
}

function hex(color) {
	return '#' + color.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
}

export function shelfPalette(record) {
	const pressing = pressingPalettes.get(record?.finish);
	if (pressing) return pressing;

	const tint = /^#[\da-f]{6}$/i.test(record?.tint) ? record.tint : '#a49bab';
	const rgb = tint
		.slice(1)
		.match(/../g)
		.map((channel) => parseInt(channel, 16));
	const brightness = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
	const base =
		brightness < 128 ? mix(rgb, [255, 255, 255], (128 - brightness) / (255 - brightness)) : rgb;

	return [
		mix(base, [248, 244, 236], 0.4),
		mix(base, [163, 153, 182], 0.35),
		mix(base, [244, 189, 161], 0.44),
		mix(base, [139, 179, 218], 0.48)
	].map(hex);
}
