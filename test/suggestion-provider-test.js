const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const Cloudant = require('cloudant');
const nock = require('nock');
const sinon = require('sinon');

const suggestionProvider = require('../actions/suggestion-provider.js');

describe('suggestion-provider', () => {
  it('err', done => {
    suggestionProvider.queryCallback('error!', {}, '')
      .then(() => {
        done(new Error('Expected method to reject.'));
      })
      .catch(err => {
        assert.notStrictEqual(err, undefined);
        done();
      })
      .catch(done);
  });

  it('empty input', done => {
    suggestionProvider.queryCallback(undefined, {results: []}, '')
      .then(data => {
        done(assert.deepStrictEqual(data, {resultsArray: [], min_rpi: Infinity, max_rpi: -Infinity}));
      })
      .catch(done);
  });

  it('with results', done => {
    let resultsInput = {
      results: [
        {
          id: '#123',
          iata: 'CMH',
          title: 'Columbus',
          text: 'Home of the Buckeyes!',
          country: 'United States of America',
          region: 'Americas',
          rpi: 75
        }
      ]
    };
    let expectedResults = {
      resultsArray: [
        {
          _id: '#123',
          name: 'Columbus',
          text: 'Home of the Buckeyes!',
          country: 'United States of America',
          region: 'Americas',
          rpi: 75,
          iata: 'CMH',
          query: 'Buckeye football.'
        }
      ],
      min_rpi: Infinity, // Min/Max RPI not calculated at this point.
      max_rpi: -Infinity
    };
    suggestionProvider.queryCallback(undefined, resultsInput, 'Buckeye football.')
      .then(data => {
        done(assert.deepStrictEqual(data, expectedResults));
      })
      .catch(done);
  });

  it('no destinations returned', done => {
    // TODO - finish stub.
    var discoveryStub = sinon.createStubInstance(DiscoveryV1);
    discoveryStub.query.returns(Promise.resolve({
      resultsArray : [],
      min_rpi : 200,
      max_rpi : 0
    }));

    var buildDiscoveryStub = sinon.stub(suggestionProvider, 'buildDiscoveryInstance');
    buildDiscoveryStub.withArgs('username', 'password')
      .returns(discoveryStub);

    var cloudantStub = sinon.createStubInstance(Cloudant);

    var buildCloudantStub = sinon.stub(suggestionProvider, 'buildCloudantInstance');

    var rssStub = sinon.stub(suggestionProvider, 'getRssFeed');
    rssStub.returns(Promise.resolve({
      'USA': 1
    }));

    assert.ok(true);
    done();
  });
});
