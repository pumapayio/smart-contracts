const compareBigNumbers = function (actual, expected) {
  String(actual).should.be.equal(String(web3.utils.toBN(expected)));
};

module.exports = {
  compareBigNumbers
};
