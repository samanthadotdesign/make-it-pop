import adapter from '@sveltejs/adapter-auto';
import githubPages from './scripts/github-pages-adapter.js';
import path from "path";
import preprocess from "svelte-preprocess";
import postcss from "./postcss.config.mjs"

const pagesBase = process.env.PAGES_BASE_PATH;
const buildingForPages = pagesBase !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	
	preprocess: [preprocess({})],
	kit: {
		adapter: buildingForPages ? githubPages() : adapter(),
		...(buildingForPages && {
			paths: { base: pagesBase },
			prerender: { enabled: false },
			trailingSlash: 'ignore'
		}),

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
