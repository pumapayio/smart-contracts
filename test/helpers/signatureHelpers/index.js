const {getVRS} = require('./sigRecovery');
const {calcSignedMessageForDeletionV1, calcSignedMessageForRegistrationV1} = require('./pullPaymentV1');
const {calcSignedMessageForDeletionV2, calcSignedMessageForRegistrationV2} = require('./pullPaymentV2');
const {calcSignedMessageToMakeSinglePullPayment} = require('./singlePullPayment');

module.exports = {
  getVRS,
  calcSignedMessageForDeletionV1,
  calcSignedMessageForDeletionV2,
  calcSignedMessageForRegistrationV1,
  calcSignedMessageForRegistrationV2,
  calcSignedMessageToMakeSinglePullPayment
};
