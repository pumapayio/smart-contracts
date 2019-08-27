const topUpErrors = {
  zeroTokenAddress: 'Invalid address for token - ZERO_ADDRESS provided.',
  zeroAddress: 'Invalid address - ZERO_ADDRESS provided.',
  emptyString: 'Invalid string - is empty.',
  lessThanZero: 'Invalid number - Must be higher than zero.',
  higherThanOverflow: 'Invalid number - Must be lower than the overflow limit.',
  invalidByte32: 'Invalid byte32 value.',
  invalidTotalLimit: 'New total amount is less than the amount spent.',
  invalidTimeBasedLimit: 'New time based amount is less than the amount spent.',
  invalidTimeBasedPeriod: 'New time based period is in the past.',
  notExecutor: 'msg.sender not an executor.',
  executorExists: 'Executor does not exists.',
  executorNotExists: 'Executor already exists.',
  notPullPaymentExecutor: 'msg.sender not allowed to execute this payment.',
  notCustomer: 'msg.sender not allowed to update this payment.',
  paymentNotExists: 'Pull Payment does not exists.',
  paymentExists: 'Pull Payment exists already.',
  paymentCancelled: 'Payment is cancelled',
  totalLimitsReached: 'Total limit reached.',
  timeBasedLimitsReached: 'Time based limit reached.',
  invalidSignatureForRegistration: 'Invalid pull payment registration - ECRECOVER_FAILED.',
  invalidSignatureForRCancellation: 'Invalid cancellation - ECRECOVER_FAILED.',
  expirationTimestampNotInTheFuture: 'Expiration timestamp must be in the future.',
  paymentIsExpired: 'Payment is expired.'
};

module.exports = {
  topUpErrors
};
