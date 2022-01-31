import { writable, get } from 'svelte/store';
import { playlist } from '@stores/userDataStore.js';

// currentTrack is the index on the playlist
export const currentTrack = writable(0);

export const playStatus = writable(false);
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

// When the track is changed, the video is changed as well
export function setAudioIndex(bool) {
	const audioIndex = get(currentTrack);
	const playlistLength = get(playlist);
	setVideoIndex(bool);
	// 0---->10
	if (bool && audioIndex < playlistLength.items.length - 1) {
		currentTrack.set(audioIndex + 1);
		// Loop back to the beginning of the playlist 10->0
	} else if (bool) {
		currentTrack.set(0);
		// 0<----10
	} else if (audioIndex > 0) {
		currentTrack.set(audioIndex - 1);
	} else {
		// If we're in the first track and go back to last track in the playlist  10<-0
		currentTrack.set(playlistLength.items.length - 1);
	}
}
