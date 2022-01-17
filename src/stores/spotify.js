    export function login(){
      // Remove cookies from user's local storage
      // Svelte uses native browser methods for cookies
			document.cookie = ""
			window.location.replace(`https://localhost:3000/api/auth/login`) 
		}