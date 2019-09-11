function encode(value) {
	if (value === undefined) {
		return 'undefined';
	}

	return JSON.stringify(value);
}

function decode(value) {
	if (value === 'undefined') {
		return undefined;
	}

	return JSON.parse(value);
}

module.exports = {
	encode,
	decode
};
