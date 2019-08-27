const EthCrypto = require('eth-crypto');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

const signRegistrationV1 = async (pullPayment, privateKey) => {
  const messageHash = web3.utils.soliditySha3(
    {
      type: 'address',
      value: pullPayment.pullPaymentExecutorAddress
    }, {
      type: 'bytes32',
      value: pullPayment.paymentID
    }, {
      type: 'bytes32',
      value: pullPayment.businessID
    }, {
      type: 'string',
      value: pullPayment.uniqueReferenceID
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
    });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

const signDeletionV1 = async (paymentID, beneficiary, privateKey) => {
  const messageHash = web3.utils.soliditySha3({
    type: 'bytes32',
    value: paymentID
  }, {
    type: 'address',
    value: beneficiary
  });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

module.exports = {
  signRegistrationV1,
  signDeletionV1
};
