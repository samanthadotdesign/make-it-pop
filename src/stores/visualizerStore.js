import { writable, get } from 'svelte/store';
import { playlist, previousTrackId } from '@stores/userDataStore.js';
import { playStatus } from './player';

// tick is the signal to request general refresh
export const tick = writable(false);

// currentTrack is the index on the playlist
export const currentTrack = writable(0);

// currentVideo is the index of current video playing for a song
// There can be multiple videos per track
export const currentVideo = writable(0);

export const defaultVideoPlaylistLength = 60;
// Handle the number of videos less than default
export const videoPlaylistLength = writable(defaultVideoPlaylistLength);

// Get random search term for video API
const defaultTermsArray = ['abstract expressionism', 'london'];
export const randomTerm = defaultTermsArray[Math.floor(Math.random() * defaultTermsArray.length)];

export const searchTerm = writable('');
export const videosData = writable([]);
export const tweenDuration = writable(350);

const initialUniform = {
	speed: { min: 0, max: 0.1, value: 0.042, step: '0.001', type: 'number', name: 'speed' },
	bump: { min: 0, max: 1, value: 0.42, step: 0.01, type: 'number', name: 'bump' },
	zoom: { min: 0, max: 20, value: 8.48, step: 0.01, type: 'number', name: 'zoom' },
	contrast: { name: 'contrast', type: 'number', min: 0, max: 3, value: 1.42, step: 0.01 },
	ballSize: { name: 'ballSize', type: 'number', min: 0, max: 1, value: 0.21, step: 0.01 },
	mirror: { name: 'mirror', type: 'boolean', value: false },
	mirrorTween: { type: 'boolean', value: false, visible: false, name: 'mirrorTween' },
	mirrorTweenProgress: { type: 'number', value: 0, visible: false, name: 'mirrorTweenProgress' }
};

// Loops back the video when the length of the videos end
// If the user goes back to previous track, go back to previous video
export function setVideoIndex(direction) {
	// Get the current video index
	const videoIndex = get(currentVideo);
	// get() is used because we can't use $currentVideo here, it's the same file, but works similarly in JS intead of Svelte
	const playlistLength = get(videoPlaylistLength);

	if (direction) {
		// Play Next
		// If videos have run out, reset the current index to 0
		if (videoIndex && videoIndex == Number(playlistLength - 1)) {
			currentVideo.set(0);
			// Go to next video
		} else {
			currentVideo.set(videoIndex + 1);
		}
	} else {
		// Play Previous
		// If we are on video 0 and press previous, then we go back to the last video
		if (videoIndex == 0) {
			currentVideo.set(playlistLength - 1);
		} else {
			// Go to previous video
			currentVideo.set(videoIndex - 1);
		}
	}
}

// setAudioIndex changes the previous track id and playStatus
// When the track is changed, the video is changed as well
export function setAudioIndex(bool) {
	const audioIndex = get(currentTrack);
	const playlistLength = get(playlist);
	let newIndex = null;
	let trackId = null;
	// When user clicks next/prev, change playStatus (which affects controls "play/pause")
	playStatus.set(true);
	setVideoIndex(bool);

	// Behaviour for controlling next/prev
	// 0---->10
	if (bool && audioIndex < playlistLength.tracks.items.length - 1) {
		newIndex = audioIndex + 1;
		// Loop back to the beginning of the playlist 10->0
	} else if (bool) {
		newIndex = 0;
		// 0<----10
	} else if (audioIndex > 0) {
		newIndex = audioIndex - 1;
	} else {
		// If we're in the first track and go back to last track in the playlist  10<-0
		newIndex = playlistLength.tracks.items.length - 1;
	}
	currentTrack.set(newIndex);

	// Change the previous track id to new track id
	trackId = playlistLength?.tracks['items']?.[newIndex]?.['track']['id'];
	previousTrackId.set(trackId);
}
