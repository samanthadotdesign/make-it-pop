import request from "request"
import { serialize } from 'cookie'

export const get = ( req, /* context */) => {
  // searchParams is a special object that we need to interface with using .get instead of a simple key
	const code = req.url && req.url.searchParams && req.url.searchParams.has("code") ? req.url.searchParams.get("code") : null
    
	// Sveltekit requires us to send back an object
	// If there is no response from Spotify GET request
	if (code === null) return {status: 401, body:{ error: true, message: 'No login code present.' }}

	const config = {
		url: 'https://accounts.spotify.com/api/token',
		form: {
      code: code,
			redirect_uri: import.meta.env.VITE_REDIRECT_URI,
			grant_type: 'authorization_code'
    },
    headers: {
			Authorization: 'Basic ' + (Buffer.from(import.meta.env.VITE_CLIENT_ID + ':' + import.meta.env.VITE_CLIENT_SECRET).toString('base64'))
		},
    json: true
   }
      
  request.post(config, (error, response, body) => {
		console.log("CHECKING HANDHSAKE RESPONSE", error, response && response.statusCode, body)
		const {access_token, expires_in, refresh_token} = body

		if (access_token && refresh_token) {
			
			return {
				status: 200, // HTTPS Status for permanent redirection (301), temporary redirection (302)
				headers: {
					'Set-Cookie': serialize(import.meta.env.VITE_ACCESS_TOKEN, access_token, {
						httpOnly: true,
						secure: import.meta.env.VITE_NODE_ENV === 'production', // needs to interface with HTTPS 
						maxAge: Number(expires_in), 
					}),
					// Redirect to home which checks for cookies
					location:`${import.meta.env.VITE_NODE_ENV == 'production' ? "https://makeitpop.ml":"http://localhost:3000"}/`
				},
			}
		} else {
			return {
				status:400,
				text:"BAD REQUEST"
			}
		}
	})
	
}
