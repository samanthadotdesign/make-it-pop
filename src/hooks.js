// src/hooks.js
import { parse } from 'cookie';

/**
 * handle is a server middleware that runs every time that we hit a GET request to Sveltekit app
 * @param {*} param object { request, resolve } provided to us by Sveltekit
 * @returns modified request
 * i.e to send cookie data as a session object on server side
 * We store the data from the cookies on the server side so it's faster for the client
 */

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const { request } = event;

	const cookies = parse(request.headers.get('cookie') || '');
	// Since we created cookies using env variable name, we should fetch cookie keys from env variables

	// If client has access token, we modify the request object
	if (cookies[import.meta.env.VITE_ACCESS_TOKEN]) {
		const access_token = cookies[import.meta.env.VITE_ACCESS_TOKEN];
		if (access_token) {
			event.locals.access_token = access_token;
			return resolve(event);
		}
	}
	// If client doesn't have access token, we send a null to be checked inside getSession
	event.locals.access_token = null;
	return resolve(event);
}

/**
 * getSession will check for the stored cookies, feed client with object in session
 * @param {*} request from Svelte metaframework
 * @returns session object with/out access token that we have accessible in the client runtime
 */
/** @type {import('@sveltejs/kit').GetSession} */
export function getSession(request) {
	const access_token = request?.locals?.access_token;
	return access_token ? { access_token } : {};
}
