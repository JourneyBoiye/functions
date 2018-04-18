const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const tokenizer = require('sbd');
const Cloudant = require('cloudant');

const parseString = require('xml2js').parseString;
import fetch from 'node-fetch';
const appendQuery = require('append-query');

const STATE_DEPARTMENT_URL = Object.freeze('https://travel.state.gov/_res/rss/TAsTWs.xml');
const FLIGHT_PRICE_FUNCTION_URL = Object.freeze('https://openwhisk.ng.bluemix.net/api/v1/' +
  'web/grioni.2%40osu.edu_dev/flights/flight-price-check.json');

const AVG_FLIGHT_COST = 400;

export function queryCallback(err, data, activities) {
  return new Promise((resolve, reject) => {
    if (err) {
      return reject(err);
    }

    var tokenizerOptions = {
      'newline_boundaries' : true,
      'html_boundaries'    : false,
      'sanitize'           : true,
      'allowed_tags'       : false,
      'abbreviations'      : null
    };

    // Retrieve up to the first 5 results.
    let results = {
      resultsArray : [],
      min_rpi: Infinity,
      max_rpi: -Infinity,
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
        rpi: body.rpi,
        iata: body.iata,
        query: activities
      };
    }
    return resolve(results);
  });
}

function queryFlightPrices(from, tos) {
  const url = formattedFlightPriceUrl(from, tos);
  return fetch(url).then(res => res.json());
}

function formattedFlightPriceUrl(from, tos) {
  const tosParam = tos.join(',');
  return appendQuery(FLIGHT_PRICE_FUNCTION_URL, {
    iataFrom: from,
    iataTo: tosParam
  });
}

export function buildDiscoveryInstance(username, password) {
  return new DiscoveryV1({
    username: username,
    password: password,
    version_date: '2016-12-01'
  });
}

export function buildCloudantInstance(account, password) {
  return new Cloudant({
    account: account,
    password: password
  });
}

export function getRssFeed() {
  return new Promise((resolve, reject) => {
    fetch(STATE_DEPARTMENT_URL)
      .then(res => res.status === 200
        ? res.text().then(text => {
          parseString(text, (err, result) => {
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
}

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

    assert(params.budget, 'params.budget cannot be null');
    assert(params.days, 'params.days cannot be null');
    assert(params.iataFrom, 'params.iataFrom cannot be null');

    // Ensure that input exists.
    params.activities = params.activities || '';

    var discovery = buildDiscoveryInstance(params.discoveryUsername, params.discoveryPassword);
    var cloudant = buildCloudantInstance(params.cloudantUsername, params.cloudantPassword);

    var database = cloudant.db.use(params.cloudantDb);

    let rssData = getRssFeed();

    let discoveryResults = new Promise(function(resolve, reject) {
      discovery.query({
        environment_id: params.environment_id,
        collection_id: params.collection_id,
        natural_language_query: params.activities,
        count: 15,
      }, (err, data) => resolve(queryCallback(err, data, params.activities)));
    });

    let flightPrices = discoveryResults.then(discoveryResults => {
      let iataTos = discoveryResults.resultsArray.map(el => el.iata);
      return queryFlightPrices(params.iataFrom, iataTos);
    });

    Promise.all([discoveryResults, rssData, flightPrices])
      .then(values => {
        var levels = values[1];
        var results = values[0].resultsArray;
        var avgs = values[2].avgs;

        results.forEach((result, i) => {
          /*
           * level 1 = safe
           * level 2 = exercise caution
           * level 3 = consider changing travel plans
           * level 4 = do not travel to
           *
           * If there is no level for the country, we assume it's safe.
           */
          result.level = levels[result.country] ? levels[result.country] : 1;
          result.avg = avgs[i];

          result.totalCost = result.rpi * params.days + result.avg.avg;
          if (!avgs[i].success || avgs[i].size === 0) {
            result.totalCost += AVG_FLIGHT_COST;
          }

          // Add the matching score for this result.
          result.absDiff = Math.abs(result.totalCost - params.budget);
          result.signDiff = result.totalCost - params.budget;
        });

        results = results.sort((a, b) => {
          return a.absDiff - b.absDiff;
        });
        values[0].resultsArray = results;

        return values[0];
      }).then(results => {
        database.bulk({docs:results.resultsArray}, err => {
          if (err) {
            return reject(null);
          }

          results.resultsArray = results.resultsArray.slice(0, 5);
          results.resultsArray.forEach(result => {
            if (result.signDiff < results.min_rpi) {
              results.min_rpi = result.signDiff;
            }
            if (result.signDiff > results.max_rpi) {
              results.max_rpi = result.signDiff;
            }
          });
          resolve(results);
        });
      });
  });
}

global.main = main;
