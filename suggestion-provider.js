const assert = require('assert');

function main(params) {
	return new Promise(function (resolve, reject) {
		assert(params, 'params cannot be null');

		// Verify input.
		assert(params.name, 'params.name cannot be null');

		return resolve({payload: 'Hello ' + params.name});
	});
}
