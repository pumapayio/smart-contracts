const EthCrypto = require('eth-crypto');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

const signTimeBasedTopUpWithExpirationRegistration = async (pullPayment, privateKey) => {
  const messageHash = web3.utils.soliditySha3(
    {
      type: 'bytes32',
      value: pullPayment.paymentID
    }, {
      type: 'bytes32',
      value: pullPayment.businessID
    }, {
      type: 'string',
      value: pullPayment.currency
    }, {
      type: 'address',
      value: pullPayment.treasuryAddress
    }, {
      type: 'uint256',
      value: pullPayment.initialConversionRate
    }, {
      type: 'uint256',
      value: pullPayment.initialPaymentAmountInCents
    }, {
      type: 'uint256',
      value: pullPayment.topUpAmountInCents
    }, {
      type: 'uint256',
      value: pullPayment.startTimestamp
    }, {
      type: 'uint256',
      value: pullPayment.totalLimit
    }, {
      type: 'uint256',
      value: pullPayment.expirationTimestamp
    }, {
      type: 'uint256',
      value: pullPayment.timeBasedLimit
    }, {
      type: 'uint256',
      value: pullPayment.timeBasedPeriod
    });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

const signTimeBasedTopUpWithExpirationCancellation = async (paymentID, businessID, privateKey) => {
  const messageHash = web3.utils.soliditySha3(
    {
      type: 'bytes32',
      value: paymentID
    }, {
      type: 'bytes32',
      value: businessID
    });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

module.exports = {
  signTimeBasedTopUpWithExpirationRegistration,
  signTimeBasedTopUpWithExpirationCancellation
};
