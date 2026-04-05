import { writable } from 'svelte/store';

export const cameraMode = writable(false);
export const cameraStream = writable(null);
