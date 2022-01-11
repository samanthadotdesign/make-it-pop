// Get user's initial playlist to show on homepage
// 1. Create playlist data variables that can be accessed from other components (RecordView, ListView)
// 2. Assign imported sample data to the variables as initial data
// json files are parsed on import 

import { writable } from "svelte/store";

// Playlist JSON from local files
import initialPlaylists from "../../static/json/playlists.json"
export const playlists = writable(initialPlaylists)

// Single playlist object (with track items) 
export const playlist = writable({}) 

export const trackAnalysis = writable({})
