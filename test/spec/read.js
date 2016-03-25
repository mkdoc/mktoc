var expect = require('chai').expect
  , mktoc = require('../../index');

describe('mktoc:', function() {

  it('should return stream with no options', function(done) {
    var stream = mktoc();
    expect(stream).to.be.an('object');
    done();
  });

});
