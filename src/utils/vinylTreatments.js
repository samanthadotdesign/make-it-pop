// Parameters of the four authored shader layers in Figma frame 154:410.
const moving = {
	intensity: 4.289999961853027,
	gradientBalance: 0,
	material: 0,
	morphSpeed: 3.740000009536743,
	detail: 1.7799999713897705,
	twist: 0.03999999910593033,
	zoom: 72,
	gradientMethod: 0,
	warp: 0.25999999046325684,
	rotationSpeed: 12
};

export const vinylTreatments = {
	float: {
		kind: 'moving',
		color: '#8178ff',
		label: '#f2ede3',
		properties: {
			...moving,
			gradient: {
				stops: [
					{ position: 0, color: { r: 1, g: 0.9137254953384399, b: 0.6196078658103943, a: 1 } },
					{ position: 0.5, color: { r: 0.5058823823928833, g: 0.47058823704719543, b: 1, a: 1 } },
					{ position: 1, color: { r: 1, g: 0, b: 0.6078431606292725, a: 1 } }
				]
			}
		}
	},
	galaxy: {
		kind: 'galaxy',
		color: '#4a197a',
		label: '#25222f',
		properties: {
			gradientStart: {
				r: 0.039000000804662704,
				g: 0.039000000804662704,
				b: 0.18000000715255737,
				a: 1
			},
			galaxyRotation: 0,
			starDensity: 0.5,
			nebulaColor: {
				r: 0.28999999165534973,
				g: 0.10000000149011612,
				b: 0.4779999852180481,
				a: 1
			},
			movementSpeed: 1,
			gradientEnd: {
				r: 0,
				g: 0,
				b: 0.019999999552965164,
				a: 1
			},
			starSize: 0.30000001192092896
		}
	},
	water: {
		kind: 'water',
		color: '#0063b4',
		label: '#80b1da',
		properties: {
			center: {
				x: 50,
				y: 50
			},
			scale: 1,
			highlightColor: {
				r: 0.8040000200271606,
				g: 0.9610000252723694,
				b: 1,
				a: 1
			},
			waterColor: {
				r: 0,
				g: 0.3880000114440918,
				b: 0.7059999704360962,
				a: 1
			},
			intensity: 0.5,
			playhead: 0
		}
	},
	dusk: {
		kind: 'moving',
		color: '#ec765e',
		label: '#f2ede3',
		properties: {
			...moving,
			gradient: {
				stops: [
					{ position: 0, color: { r: 1, g: 0.8235294222831726, b: 0.5411764979362488, a: 1 } },
					{
						position: 0.5,
						color: { r: 0.9254902005195618, g: 0.4627451002597809, b: 0.3686274588108063, a: 1 }
					},
					{
						position: 1,
						color: { r: 0.2862745225429535, g: 0.2078431397676468, b: 0.38823530077934265, a: 1 }
					}
				]
			}
		}
	}
};
