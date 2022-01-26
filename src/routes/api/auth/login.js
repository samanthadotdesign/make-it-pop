// Svelte middleware, js file that gives a request + response 
// Not using NodeJS, exporting a named variable like a GET request 
// Defined by the route api/auth/login (folder structure that this file is in)
// We don't get a req + res object like an Express server. We return an object, similar as "res.header", "res.status" in NodeJS
// Setting the cookies that the response will have

import queryString from 'query-string'
import { serialize } from 'cookie'

export const get = ( /*req, context */) => {

    // Create a random id as an authentication id 
    const auth_id = Math.random().toString(36).slice(5, 11).toUpperCase()
    const query = queryString.stringify({
      response_type: 'code',
      scope: ["playlist-read-collaborative playlist-read-private streaming user-read-email user-read-private user-read-playback-state user-read-recently-played user-modify-playback-state"],
      state: auth_id,
      client_id: import.meta.env.VITE_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_REDIRECT_URI,
    })

    return {
			status: 302, // HTTPS Status for permanent redirection (301), temporary redirection (302)
			headers: {
         'Set-Cookie': serialize('MAKE_IT_POP_STATE_KEY', auth_id, {
             httpOnly: true,
             secure: import.meta.env.VITE_NODE_ENV === 'production', // needs to interface with HTTPS 
             maxAge: 60 * 60 * 24 * 7, // one week
         }),
				 location:'https://accounts.spotify.com/authorize?' + query
     	},
		}
  }
