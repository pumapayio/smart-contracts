const {assertRevert} = require('./helpers/assertionHelper');
const {
  calcSignedMessageForRegistration,
  calcSignedMessageForRegistrationV2,
  calcSignedMessageToMakeSinglePullPayment,
  getVRS
} = require('./helpers/signatureHelpers/singlePullPayment');
const PumaPayToken = artifacts.require('MockMintableToken');

const PumaPayPullPayment = artifacts.require('TopUpPullPayment');
const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const MINUTE = 60; // 60 seconds
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MINTED_TOKENS = web3.utils.toWei('90000000000', 'ether'); // 90 Billion PMA

const CLIENT_PRIVATE_KEY = '0xc929da34af736b0f97ed3622980d8af51f762188f12e575f46fccdcf687ced66';

contract('Single Pull Payment Smart Contract', (accounts) => {

});
