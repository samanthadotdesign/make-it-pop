    export function login(){
      // Remove cookies from user's local storage
      // Svelte uses native browser methods for cookies
			document.cookie = ""
      // Change protocol depending on environment variables
			window.location.replace(`${import.meta.env.VITE_NODE_ENV == 'production' ? "https://makeitpop.ml":"http://localhost:3000"}/api/auth/login`) 
		}

    