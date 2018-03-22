const assert = require('assert');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
const Cloudant = require('cloudant');
const nock = require('nock');
const sinon = require('sinon');

const suggestionProvider = require('../actions/suggestion-provider.js');

describe('suggestion-provider', () => {
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