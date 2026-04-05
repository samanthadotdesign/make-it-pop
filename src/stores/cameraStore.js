import { writable } from 'svelte/store';

export const cameraMode = writable(false);
export const cameraStream = writable(null);
export const customVideos = writable(false); // true when user has searched or used camera
