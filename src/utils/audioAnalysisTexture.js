import * as THREE from 'three';

const easeOutSine = (t, b, c, d) => {
	return c * Math.sin((t / d) * (Math.PI / 2)) + b;
};

const easeOutQuad = (t, b, c, d) => {
	t /= d;
	return -c * t * (t - 2) + b;
};

export default class AudioAnalysisTexture {
	constructor(options) {
		this.size = 64;
		this.width = this.height = this.size;

		this.maxAge = 64;
		this.radius = 0.1 * this.size;
		// this.radius = 0.15 * 1000;

		this.speed = 1 / this.maxAge;
		// this.speed = 0.01;

		this.trail = [];
		this.last = null;

		if (options.debug) {
			this.width = window.innerWidth;
			this.height = window.innerHeight;

			this.radius = this.width * 0.1;
		}

		this.initTexture();

		if (options.debug) document.body.append(this.canvas);
	}

	initTexture() {
		this.canvas = document.createElement('canvas');
		this.canvas.id = 'AudioAnalysisTexture';
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.ctx = this.canvas.getContext('2d');
		this.texture = new THREE.Texture(this.canvas);

		this.clear();
		// x, y, 64px, 64px -> creates a 64px black square

		// this.canvas.style.width = this.canvas.style.height = `${
		//   this.canvas.width
		// }px`;
	}

	addPoint(point) {
		const { red, green, blue } = point;
		// called externally (not called in the constructor)
		let force = 0; // these are the properties of the point
		let vx = 0;
		let vy = 0;
		const last = this.last; // this.last was null in the beginning, last is previous point
		if (last) {
			const relativeX = point.x - last.x;
			const relativeY = point.y - last.y;
			if (relativeX === 0 && relativeY === 0) return; // returning nothing bc there is no distance between last point adn current point
			const distanceSquared = relativeX * relativeX + relativeY * relativeY; // area for the distance (x^2 + y^2)
			const distance = Math.sqrt(distanceSquared); // distance between the two points
			vx = relativeX / distance; // translating the anchor point to be the center
			// vx and vy are the coordinates of the center of the mouse area
			vy = relativeY / distance;

			// force is a decimal between 0 and 1, and it's defines how aggressive was the movement
			force = Math.min(distanceSquared * 10000, 1); // dd is a very small number so we make it bigger
			// force = Math.sqrt(dd)* 50.;
			// force = 1;
		}
		// keep track of where the mouse is by tracking the last
		this.last = {
			/// checking if this is the first point created or a continuous movement
			// if there is a last point, he starts defining the x and y (distance betwenen last point and current point)
			x: point.x,
			y: point.y
		};
		// pushing a new point to the trail
		// this is how we produce the trail
		// age : 0, every mouse trail starts with age of 0 and lives for 64ms
		this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy, red, green, blue });
	}

	update() {
		this.clear(); // clear to sets the context - resets the black square

		let agePart = 1 / this.maxAge;

		this.trail.forEach((point, i) => {
			// the mouse movements (stores hisotry of where mouse has been)
			// eath path that the mouse takes
			// point = {force, x, y, vx, vy,
			// age = how long ago from the moment the mouse has moved}

			let slowAsOlder = 1 - point.age / this.maxAge;
			let force = point.force * agePart * slowAsOlder;

			// redefining and recalculating the properties of the point object
			point.x += point.vx * force;
			point.y += point.vy * force;
			point.age++; // udpating to the correct time

			// time measurements (action time frame where the mouse movements affects)
			if (point.age > this.maxAge) {
				this.trail.splice(i, 1); // removes that path (trail) from the array
			}
		});

		this.trail.forEach((point) => {
			this.drawPoint(point);
		});

		this.texture.needsUpdate = true; // reassigns a new property needUpdate
	}
	clear() {
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	// this is what draws the paths
	// scaling parameter to fit under browser size
	// x and y are percentages (beatConfidence, loudnessAverage)
	drawPoint(point) {
		const { red, green, blue } = point;

		// the area of the opacity mask
		const pos = {
			x: (point.x * this.width) / 100,
			y: (point.y * this.height) / 100
		};

		const radius = this.radius;
		const ctx = this.ctx;

		let intensity = 1;

		// managing the curve of disappearing, disappears slower in the beginning, faster at the end
		if (point.age < this.maxAge * 0.3) {
			// intensity depends on the age
			intensity = easeOutSine(point.age / (this.maxAge * 0.3), 0, 1, 1);
		} else {
			intensity = easeOutQuad(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7), 0, 1, 1);
		}
		intensity *= point.force; // point.force 0 to 1
		// intensity is decreasing constantly
		// value that we use to create the fade – because it's constantly getting smaller
		// rgb (255,255,255) => white mask that allows us to see the actual color of the plane
		/* let red = ((point.vx + 1) / 2) * 255;
		let green = ((point.vy + 1) / 2) * 255;
		let blue = intensity * 255; */
		// Track analysis pitches (three group) to create different colors
		let color = `${red}, ${green}, ${blue}`;

		/* ---- REFERENCE THE COLOUR HERE DIRECTLY ---- */
		/* INTENSITY WORKS AS IS */

		// depending on the distance between the points (larger)
		// the colour and size of the mask is smaller and more faded

		let offset = this.width * 5;
		ctx.shadowOffsetX = offset; // (default 0)
		ctx.shadowOffsetY = offset; // (default 0)
		ctx.shadowBlur = radius * 1; // (default 0)
		ctx.shadowColor = `rgba(${color},${0.2 * intensity})`; // (default transparent black)

		// Track analysis loudness connected to ThreeJS scene intensity
		this.ctx.beginPath();
		this.ctx.fillStyle = 'rgba(255,0,0,1)';
		this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
		this.ctx.fill();
	}
}
