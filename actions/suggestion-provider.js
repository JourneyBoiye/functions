const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const NLCV1 = require('watson-developer-cloud/natural-language-classifier/v1');
const tokenizer = require('sbd');
const Cloudant = require('cloudant');

const parseString = require('xml2js').parseString;
import fetch from 'node-fetch';

const STATE_DEPARTMENT_URL = 'https://travel.state.gov/_res/rss/TAsTWs.xml';

function main(params) {
  return new Promise((resolve, reject) => {
    assert(params, 'params cannot be null');

    // Verify discovery parameters present.
    assert(params.discoveryUsername, 'params.discoveryUsername cannot be null');
    assert(params.discoveryPassword, 'params.discoveryPassword cannot be null');

    // Verify NLC parameters present.
    assert(params.nlcUsername, 'params.nlcUsername cannot be null');
    assert(params.nlcPassword, 'params.nlcPassword cannot be null');

    // Verify Cloudant parameters present.
    assert(params.cloudantUsername, 'params.cloudantUsername cannot be null');
    assert(params.cloudantPassword, 'params.cloudantPassword cannot be null');
    assert(params.cloudantDb, 'params.cloudantDb cannot be null');

    // Verify input.
    assert(params.activities, 'params.activities cannot be null');

    var discovery = new DiscoveryV1({
      username: params.discoveryUsername,
      password: params.discoveryPassword,
      version_date: '2016-12-01'
    });

    var cloudant = new Cloudant({
      account: params.cloudantUsername,
      password: params.cloudantPassword,
    });
    var database = cloudant.db.use(params.cloudantDb);

    var tokenizerOptions = {
      'newline_boundaries' : true,
      'html_boundaries'    : false,
      'sanitize'           : true,
      'allowed_tags'       : false,
      'abbreviations'      : null
    };

    let rssData = new Promise((resolve, reject) => {
      fetch(STATE_DEPARTMENT_URL)
        .then(res => res.status === 200
          ? res.text().then(text => {
            parseString(text, function(err, result) {
              if (err) {
                reject(err);
              } else {
                var notices = {};
                const advisory = result.rss.channel[0];
                advisory.item.forEach(detail => {
                  // Some row use '–' instead of '-', make them uniform.
                  var countryLevel = detail.title[0]
                    .replace('–', '-')
                    .split('-');
                  try {
                    notices[countryLevel[0].trim()] =
                      parseInt(countryLevel[1].trim().match(/\d/)[0]);
                  }
                  catch (error) {
                    return; // Skip any we encounter an error with.
                  }
                });
                resolve(notices);
              }
            });
          })
          : reject(res.status));
    });

    let discoveryResults = new Promise(function(resolve, reject) {
      discovery.query({
        environment_id: params.environment_id,
        collection_id: params.collection_id,
        natural_language_query: params.activities,
        count: 15,
      }, function(err, data) {
        if (err) {
          return reject(err);
        }

        // Compute the max/min budgets
        let min_rpi = 200;
        let max_rpi = 0;

        // Retrieve up to the first 5 results.
        let results = {
          resultsArray : [],
          min_rpi : 200,
          max_rpi : 0
        };
        for (var i = 0; i < data['results'].length; i++) {
          let body = data.results[i];
          let title = body.title;
          let sentences = tokenizer.sentences(
            body.text.replace(/\s+/g, ' ').trim(),
            tokenizerOptions);
          let text = sentences[0].replace(/&quot;/g, '"').trim();
          let country = body.country;
          let region = body.region;

          results.resultsArray[i] = {
            _id: body.id,
            name: title,
            text: text,
            country: country,
            region: region,
            rpi: body.rpi
          };

          if (body.rpi < results[min_rpi]) {
            min_rpi = body.rpi;
          }
          if (body.rpi > results[max_rpi]) {
            max_rpi = body.rpi;
          }
        }

        return resolve(results);
      });
    }).then(results => {
      database.bulk({docs:results}, err => {
        if (err) {
          return Promise.reject(null);
        }
      });
      return results;
    });


    Promise.all([discoveryResults, rssData])
      .then(values => {
        var levels = values[1];
        var results = values[0].resultsArray;
        results.forEach(result => {
          /*
           * level 1 = safe
           * level 2 = exercise caution
           * level 3 = consider changing travel plans
           * level 4 = do not travel to
           *
           * If there is no level for the country, we assume it's safe.
           */
          result.level = levels[result.country] ? levels[result.country] : 1;
        });
        resolve(values[0]);
      });
  });
}

global.main = main;
