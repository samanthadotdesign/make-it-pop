import axios from 'axios';

export const get = async (req /* context */) => {
	// searchParams is a special object that we need to interface with using .get instead of a simple key
	// We sent the query to Spotify in login.js, req is a query response comes from Spotify
	// code is the proof that the user did the login & gave authorization
	const code =
		req.url && req.url.searchParams && req.url.searchParams.has('code')
			? req.url.searchParams.get('code')
			: null;

	// Sveltekit requires us to send back an object
	// If there is no response from Spotify GET request
	if (code === null)
		return { status: 401, body: { error: true, message: 'No login code present.' } };

	const url = 'https://accounts.spotify.com/api/token';
	const body = {
		code: code,
		redirect_uri: import.meta.env.VITE_REDIRECT_URI,
		grant_type: 'authorization_code'
	};

	// axios doesn't want FormData format, create a serialize function to convert data to string separated format
	const serialize = function (obj) {
		let str = [];
		for (const p in obj) {
			/*eslint no-prototype-builtins: "off"*/
			if (obj.hasOwnProperty(p)) {
				str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
			}
		}
		return str.join('&');
	};

	const setCookieValue = ({ key, value, options }) => {
		const { maxAge, secure, sameSite } = options;

		return `${key}=${value || ''}; Max-Age=${maxAge}; Path=/; ${
			secure ? 'Secure;' : ''
		} HttpOnly; SameSite=${sameSite}`;
	};

	const response = await axios
		.post(url, serialize(body), {
			headers: {
				Authorization:
					'Basic ' +
					Buffer.from(
						import.meta.env.VITE_CLIENT_ID + ':' + import.meta.env.VITE_CLIENT_SECRET
					).toString('base64')
			}
		})
		.then((response) => {
			const { data, status, error, body } = response;
			return { status, data, error, body };
		})
		.catch(function (error) {
			console.log('ERROR WHILE REQUESTING TOKENS', error);
		});

	const { error, data: finalResponseBody } = response;
	const { access_token, expires_in, refresh_token } = finalResponseBody;

	let res;

	// To make POST request on behalf of the user, we use the access_token & refresh_token
	if (access_token && refresh_token) {
		res = {
			status: 302, // HTTPS Status for permanent redirection (301), temporary redirection (302)
			headers: {
				'set-cookie': [
					setCookieValue({
						key: import.meta.env.VITE_ACCESS_TOKEN,
						value: access_token,
						options: {
							secure: import.meta.env.VITE_NODE_ENV === 'production',
							maxAge: Number(expires_in)
						}
					}),
					setCookieValue({
						key: import.meta.env.VITE_REFRESH_TOKEN,
						value: refresh_token,
						options: {
							secure: import.meta.env.VITE_NODE_ENV === 'production',
							maxAge: Number(expires_in)
						}
					}),
					setCookieValue({
						key: import.meta.env.VITE_REFRESH_CODE,
						value: code,
						options: {
							secure: import.meta.env.VITE_NODE_ENV === 'production',
							maxAge: Number(expires_in)
						}
					})
				],
				// Redirect to home which checks for cookies
				location: `${
					import.meta.env.VITE_NODE_ENV == 'production'
						? 'https://makeitpop.ml'
						: 'http://localhost:3000'
				}/`
			}
		};
	} else if (error) {
		res = {
			status: 302,
			headers: {
				location: `${
					import.meta.env.VITE_NODE_ENV == 'production'
						? 'https://makeitpop.ml'
						: 'http://localhost:3000'
				}/?error=Unauthorized`
			}
		};
	}
	return res;
};
