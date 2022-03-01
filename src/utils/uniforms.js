// Configuration object for the visualization
export function buildUniforms(uni) {
	const uniforms = { ...uni };
	// cloning the object that is being referenced somewhere else to avoid side effects by modifying the variable
	// bools is an array that has the values of each uniform which has the boolean type
	const bools = Object.keys(uniforms)
		.filter((key) => uniforms[key].type === 'boolean')
		.map((key) => uniforms[key]);
	bools.forEach(({ name }) => {
		// for each boolean properties, we add 2 new keys to the uniforms object that has the value,type,visible characters
		// using the tween to track the state of the boolean change
		uniforms[`${name}Tween`] = {
			value: false,
			type: 'boolean',
			visible: false
		};
		// tracking the value in integer form
		uniforms[`${name}TweenProgress`] = {
			value: 0,
			type: 'number',
			visible: false
		};
	});
	return uniforms;
}

export function getBooleanChanges(val, old) {
	const booleans = getBooleans(val);
	// filters properties that spotify determines that are not visible / visualizable
	// returns an object { propertyTypeBoolean1: {value: ...} , propertyTypeBoolean2: {value: ...},}
	// clean object
	const oldBooleans = getBooleans(old);
	const changes = [];
	Object.keys(booleans).forEach((key) => {
		// keys are [propertyTypeBoolean1, propertyTypeBoolean2 ...]
		const { name, value } = booleans[key];
		if (!oldBooleans[name]) return;
		// checking if the new value existed in the old value
		if (oldBooleans[name].value !== value) changes.push(name);
		// checking if the value changed (from true to false)
	});
	return changes;
	// changes array of propertyTypeBooleans that have changed
}

export function getBooleans(uniforms) {
	return _getUniformsByType(uniforms, 'boolean');
}

export function getTweenableChanges(to, from) {
	try {
		return Object.keys(from).reduce((acc, key) => {
			// non tweenable keys
			if (from[key].type === 'boolean' || from[key].visible === false) return acc;
			const tweenable = ['min', 'max', 'value', 'step'];
			// for each of these 'min'..., check if the value matches
			tweenable.forEach((val) => {
				if (to[key][val] !== from[key][val]) {
					acc[key] = acc[key] || [];
					acc[key].push(val);
				}
			});
			return acc;
		}, {});
		// configuration object that describes which values we're able to tween
		// that includes the keys of the properties that we will be able to interpolate
	} catch (e) {
		return {};
	}
}

function _getUniformsByType(src, type) {
	return Object.keys(src)
		.filter((v) => src[v].type === type)
		.reduce((acc, key) => {
			if (src[key].visible === false) return acc;
			acc[key] = src[key];
			return acc;
		}, {});
}
