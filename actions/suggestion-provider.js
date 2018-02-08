const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const NLCV1 = require('watson-developer-cloud/natural-language-classifier/v1');

function main(params) {
  return new Promise(function (resolve, reject) {
    assert(params, 'params cannot be null');

    // Verify discovery parameters present.
    assert(params.discoveryUsername, 'params.discoveryUsername cannot be null');
    assert(params.discoveryPassword, 'params.discoveryPassword cannot be null');

    // Verify NLC parameters present.
    assert(params.nlcUsername, 'params.nlcUsername cannot be null');
    assert(params.nlcPassword, 'params.nlcPassword cannot be null');

    // Verify input.
    assert(params.input, 'params.input cannot be null');
    assert(params.input.text, 'params.input.text cannot be null');

    var discovery = new DiscoveryV1({
      username: params.discoveryUsername,
      password: params.discoveryPassword,
      version_date: '2016-12-01'
    });

    discovery.query({
      environment_id: params.environment_id,
      collection_id: params.collection_id,
      query: params.input.text
    }, function(err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports.main = main;
