import {colorsArray} from "./src/stores/layoutStore.js"

const colors = colorsArray.reduce((acc, curr)=>{
 return [...acc, `bg-[${curr}]`]
},[])

export default {
  content: [
    "./src/**/*.{svelte,html}"
  ],
  // SAFELIST IS A LIST OF CLASSES THAT WON'T BE PURGED
  safelist: colors,
  theme: {
    extend: {},
  },
  plugins: [],
}
