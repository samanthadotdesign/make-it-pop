import { writable } from 'svelte/store';

export function login() {
	// Remove cookies from user's local storage
	// Svelte uses native browser methods for cookies
	document.cookie = '';
	// Change protocol depending on environment variables
	window.location.replace(
		`${
			import.meta.env.VITE_NODE_ENV == 'production'
				? 'https://makeitpop.ml'
				: import.meta.env.VITE_PROJECT_ROOT
		}/api/auth/login`
	);
}

export const deviceSettings = writable({});
