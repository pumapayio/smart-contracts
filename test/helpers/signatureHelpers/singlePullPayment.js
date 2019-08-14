const EthCrypto = require('eth-crypto');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

const calcSignedMessageToMakeSinglePullPayment = async (pullPayment, privateKey) => {
  const messageHash = web3.utils.soliditySha3(
    {
      type: 'bytes32',
      value: pullPayment.paymentID
    }, {
      type: 'bytes32',
      value: pullPayment.businessID
    }, {
      type: 'uint256',
      value: pullPayment.amountInPMA
    }, {
      type: 'address',
      value: pullPayment.client
    }, {
      type: 'address',
      value: pullPayment.treasuryAddress
    }, {
      type: 'string',
      value: pullPayment.uniqueReferenceID
    });

  const signedMessage = EthCrypto.sign(
    privateKey, messageHash
  );

  return signedMessage;
};

module.exports = {
  calcSignedMessageToMakeSinglePullPayment
};
