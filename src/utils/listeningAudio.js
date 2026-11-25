// Keep one media element across shelf navigation so browsers can retain its playback permission.
let audio;
let playbackGranted = false;

export function getListeningAudio() {
	if (!audio) {
		audio = new Audio();
		audio.preload = 'auto';
	}
	return audio;
}

export async function playListeningAudio() {
	await getListeningAudio().play();
	playbackGranted = true;
}

export function primeListeningAudio() {
	if (playbackGranted) return;
	const player = getListeningAudio();

	// A brief silent PCM sample claims the click gesture without starting the record early.
	player.src =
		'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
	playListeningAudio().catch(() => {});
}
