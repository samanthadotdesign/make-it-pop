import { writable } from "svelte/store";

// currentTrack is the index on the playlist
export const currentTrack = writable(0)

// Get random search term for video API
const defaultTermsArray = ['abstract expressionism', 'london']
export const randomTerm = defaultTermsArray[Math.floor(Math.random() * defaultTermsArray.length)];

export const searchTerm = writable('')
export const videosData = writable([])