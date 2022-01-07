import adapter from '@sveltejs/adapter-auto';
import path from "path";
import preprocess from "svelte-preprocess";
import postcss from "./postcss.config.mjs"

/** @type {import('@sveltejs/kit').Config} */
const config = {
	
	preprocess: [preprocess({})],
	kit: {
		adapter: adapter(),

		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		vite: {
			css:{
				postcss
			},
      resolve: {
        alias: {
          // these are the aliases and paths to them
          "@stores": path.resolve("./src/stores"),
          "@components": path.resolve("./src/components"),
          "@utils": path.resolve("./src/utils"),
        },
      },
    },
	}
};

export default config;
