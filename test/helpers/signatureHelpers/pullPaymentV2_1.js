const EthCrypto = require('eth-crypto');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

const signRegistrationV2_1 = async (pullPayment, privateKey) => {
  const messageHash = web3.utils.soliditySha3(
    {
      type: 'bytes32',
      value: pullPayment.paymentID
    }, {
      type: 'bytes32',
      value: pullPayment.paymentType
    }, {
      type: 'address',
      value: pullPayment.treasuryAddress
    }, {
      type: 'string',
      value: pullPayment.currency
    }, {
      type: 'uint256',
      value: pullPayment.initialPaymentAmountInCents
    }, {
      type: 'uint256',
      value: pullPayment.fiatAmountInCents
    }, {
      type: 'uint256',
      value: pullPayment.frequency
    }, {
      type: 'uint256',
      value: pullPayment.numberOfPayments
    }, {
      type: 'uint256',
      value: pullPayment.startTimestamp
    }, {
      type: 'uint256',
      value: pullPayment.trialPeriod
    });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

const signDeletionV2_1 = async (paymentID, privateKey) => {
  const messageHash = web3.utils.soliditySha3({
    type: 'bytes32',
    value: paymentID
  });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

module.exports = {
  signRegistrationV2_1,
  signDeletionV2_1
};
