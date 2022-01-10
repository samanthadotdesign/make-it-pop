import { writable } from "svelte/store";

// currentTrack is the index on the playlist
export const currentTrack = writable(0)