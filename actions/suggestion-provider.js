const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const NLCV1 = require('watson-developer-cloud/natural-language-classifier/v1');
const tokenizer = require('sbd');

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
    assert(params.activities, 'params.input cannot be null');
    // assert(params.input.text, 'params.input.text cannot be null');

    var discovery = new DiscoveryV1({
      username: params.discoveryUsername,
      password: params.discoveryPassword,
      version_date: '2016-12-01'
    });

    var tokenizerOptions = {
      'newline_boundaries' : true,
      'html_boundaries'    : false,
      'sanitize'           : true,
      'allowed_tags'       : false,
      'abbreviations'      : null
    };

    return discovery.query({
      environment_id: params.environment_id,
      collection_id: params.collection_id,
      natural_language_query: params.activities,
      count: 5,
    }, function(err, data) {
      if (err) {
        return reject(err);
      }

      // Retrieve up to the first 5 results.
      let results = [];
      for (var i = 0; i < data['results'].length; i++) {
        let body = data.results[i];
        let title = body.title;
        let sentences = tokenizer.sentences(
          body.text.replace(/\s+/g, ' ').trim(),
          tokenizerOptions);
        let text = sentences[0].trim();
        results[i] = {
          name: title,
          text: text,
        };
      }
      return resolve({results});
    });
  });
}

global.main = main;
