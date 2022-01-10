import {writable} from "svelte/store"

// 1. Curated list of colours
// 2. Randomize organization of colours in the array
// 3. Fetch in order of index
export const colorsArray = ['#000', '#ccc', "#f8f8f8", "#6195ED"]

function randomizeColors (array){
	let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

export const colors = randomizeColors(colorsArray)

// Scroll info
export const windowObject = writable({width:0, height:0})