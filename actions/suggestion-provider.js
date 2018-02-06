const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');

function main(params) {
	return new Promise(function (resolve, reject) {
		assert(params, 'params cannot be null');

		// Verify discovery parameters present.
		assert(params.discoveryUsername, 'params.discoveryUsername cannot be null');
		assert(params.discoveryUsername, 'params.discoveryPassword cannot be null');

		// Verify input.
		assert(params.name, 'params.name cannot be null');

		return resolve({payload: 'Hello ' + params.name});
	});
}
