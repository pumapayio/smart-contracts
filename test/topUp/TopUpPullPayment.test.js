const {assertRevert} = require('../helpers/assertionHelper');
const {
  calcSignedMessageForTopUpRegistration,
  calcSignedMessageForTopUpCancellation,
  getVRS
} = require('../helpers/signatureHelpers');
const {topUpErrors} = require('../helpers/errorHelpers');
const {transferETH} = require('../helpers/tranfserHelper');
const {compareBigNumbers} = require('../helpers/comparisonHelper');
const {timeTravel, currentBlockTime} = require('../helpers/timeHelper');

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
const OVERFLOW_CHECK = '1000000000000000000000'; // 10^20
const MINTED_TOKENS = web3.utils.toWei('90000000000', 'ether'); // 90 Billion PMA
const DECIMAL_FIXER = 10 ** 10;
const FIAT_TO_CENT_FIXER = 100;
const EUR_EXCHANGE_RATE = 0.01 * DECIMAL_FIXER; // 1 PMA = 0.01 EUR
const USD_EXCHANGE_RATE = 0.05 * DECIMAL_FIXER; // 1 PMA = 0.05 USD

const MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS = 0.15;
const FUNDING_AMOUNT = web3.utils.toWei('0.5', 'ether');
const GAS_PRICE = 1000000000;

const INITIAL_PAYMENT_AMOUNT = 1000; // 10.00 FIAT
const TOP_UP_AMOUNT = 500; // 5.00 FIAT
const TOTAL_LIMIT = 10000; // 100 FIAT

const CLIENT_PRIVATE_KEY = '0xc929da34af736b0f97ed3622980d8af51f762188f12e575f46fccdcf687ced66';

contract('Top Up Pull Payment Smart Contract', (accounts) => {
  const deployerAccount = accounts[ 0 ];
  const owner = accounts[ 1 ];
  const executor = accounts[ 2 ];
  const customerAddress = accounts[ 3 ];
  const treasuryAddress = accounts[ 4 ];
  const pullPaymentExecutor = accounts[ 5 ];
  const secondExecutor = accounts[ 6 ];

  let token;
  let pumaPayPullPayment;

  const topUpPayment = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
    currency: 'EUR',
    customerAddress: customerAddress,
    treasuryAddress: treasuryAddress,
    pullPaymentExecutorAddress: pullPaymentExecutor,
    initialConversionRate: USD_EXCHANGE_RATE,
    initialPaymentAmountInCents: INITIAL_PAYMENT_AMOUNT,
    topUpAmountInCents: TOP_UP_AMOUNT,
    startTimestamp: Math.floor(Date.now() / 1000),
    totalLimit: TOTAL_LIMIT
  };

  const numberOfTotalAllowedTopUps = Math.floor(( topUpPayment.totalLimit / topUpPayment.topUpAmountInCents ));

  const prepareSmartContract = async () => {
    await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
      from: customerAddress
    });
    await transferETH(2, deployerAccount, pumaPayPullPayment.address);
    await pumaPayPullPayment.addExecutor(executor, {
      from: owner
    });
  };

  const registerPullPayment = async () => {
    const signature = await calcSignedMessageForTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    const result = await pumaPayPullPayment.registerPullPayment(
      sigVRS.v,
      sigVRS.r,
      sigVRS.s,
      [ topUpPayment.paymentID, topUpPayment.businessID ],
      [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
      [
        topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents,
        topUpPayment.topUpAmountInCents, topUpPayment.startTimestamp, topUpPayment.totalLimit
      ],
      topUpPayment.currency,
      {
        from: executor
      });

    return result;
  };

  const registerForRevert = async (parameter, wrongValue, expectedError) => {
    const oldValue = topUpPayment[ parameter ];
    topUpPayment[ parameter ] = wrongValue;

    const signature = await calcSignedMessageForTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    await assertRevert(
      pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ topUpPayment.paymentID, topUpPayment.businessID ],
        [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
        [
          topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents,
          topUpPayment.topUpAmountInCents, topUpPayment.startTimestamp, topUpPayment.totalLimit
        ],
        topUpPayment.currency,
        {
          from: executor
        }),
      expectedError
    );
    topUpPayment[ parameter ] = oldValue;
  };

  const cancelPullPayment = async () => {
    const signature = await calcSignedMessageForTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    const result = await pumaPayPullPayment.cancelTopUpPayment(
      sigVRS.v,
      sigVRS.r,
      sigVRS.s,
      topUpPayment.paymentID,
      {
        from: executor
      });

    return result;
  };

  const cancelForRevert = async (parameter, wrongValue, expectedError) => {
    const oldValue = topUpPayment[ parameter ];
    topUpPayment[ parameter ] = wrongValue;

    const signature = await calcSignedMessageForTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    await assertRevert(
      pumaPayPullPayment.cancelTopUpPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        topUpPayment.paymentID,
        {
          from: executor
        }),
      expectedError
    );
    topUpPayment[ parameter ] = oldValue;
  };

  beforeEach('Deploying new PumaPayToken', async () => {
    token = await PumaPayToken.new({
      from: deployerAccount
    });
  });

  beforeEach('Deploying new PumaPay Top Up Pull Payment', async () => {
    pumaPayPullPayment = await PumaPayPullPayment
      .new(token.address, {
        from: owner
      });
  });

  beforeEach('Issue tokens to the clients', async () => {
    const tokens = MINTED_TOKENS;
    await token.mint(customerAddress, tokens, {
      from: deployerAccount
    });
  });

  describe('Deploying', async () => {
    it('PumaPay Pull Payment owner should be the address that was specified on contract deployment', async () => {
      const accountOwner = await pumaPayPullPayment.owner();

      assert.equal(accountOwner.toString(), owner);
    });

    it('PumaPay Pull Payment token should be the token address specified on contract deployment', async () => {
      const accountToken = await pumaPayPullPayment.token();

      assert.equal(accountToken, token.address);
    });

    it('PumaPay Pull Payment deployment should revert when the token is a ZERO address', async () => {
      await assertRevert(PumaPayPullPayment
          .new(ZERO_ADDRESS, {
            from: deployerAccount
          }),
        topUpErrors.zeroTokenAddress
      );
    });
  });

  describe('Register a top up pull payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    it('should add the top up payment in the smart contract mapping', async () => {
      await registerPullPayment();

      const ethDate = await currentBlockTime();
      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);

      pullPaymentInArray.currency.should.be.equal(topUpPayment.currency);
      pullPaymentInArray.customerAddress.should.be.equal(topUpPayment.customerAddress);
      pullPaymentInArray.treasuryAddress.should.be.equal(topUpPayment.treasuryAddress);
      // pull payment checks
      compareBigNumbers(pullPaymentInArray.initialConversionRate, topUpPayment.initialConversionRate);
      compareBigNumbers(pullPaymentInArray.initialPaymentAmountInCents, topUpPayment.initialPaymentAmountInCents);
      compareBigNumbers(pullPaymentInArray.topUpAmountInCents, topUpPayment.topUpAmountInCents);
      compareBigNumbers(pullPaymentInArray.startTimestamp, topUpPayment.startTimestamp);
      compareBigNumbers(pullPaymentInArray.startTimestamp, topUpPayment.startTimestamp);
      compareBigNumbers(pullPaymentInArray.lastPaymentTimestamp, ethDate);
      compareBigNumbers(pullPaymentInArray.totalLimit, topUpPayment.totalLimit);
      compareBigNumbers(pullPaymentInArray.cancelTimestamp, 0);
      compareBigNumbers(pullPaymentInArray.totalSpent, 0);
    });

    it('should transfer the PMA for the initial payment', async () => {
      await registerPullPayment();

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      compareBigNumbers(treasuryBalanceAfter, expectedAmountOfPmaTransferred);
    });

    it('should revert if not called by one of the executors', async () => {
      const signature = await calcSignedMessageForTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(
        pumaPayPullPayment.registerPullPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          [ topUpPayment.paymentID, topUpPayment.businessID ],
          [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
          [
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents,
            topUpPayment.topUpAmountInCents, topUpPayment.startTimestamp, topUpPayment.totalLimit
          ],
          topUpPayment.currency,
          {
            from: owner
          }),
        topUpErrors.notExecutor
      );
    });
    it('should revert if you try to register the same payment twice', async () => {
      const signature = await calcSignedMessageForTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await registerPullPayment();
      await assertRevert(
        pumaPayPullPayment.registerPullPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          [ topUpPayment.paymentID, topUpPayment.businessID ],
          [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
          [
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents,
            topUpPayment.topUpAmountInCents, topUpPayment.startTimestamp, topUpPayment.totalLimit
          ],
          topUpPayment.currency,
          {
            from: executor
          }),
        topUpErrors.paymentExists
      );
    });
    it('should revert if paymentID is empty', async () => {
      await registerForRevert('paymentID', web3.utils.padRight(web3.utils.fromAscii(''), 64), topUpErrors.invalidByte32);
    });
    it('should revert if businessID is empty', async () => {
      await registerForRevert('businessID', web3.utils.padRight(web3.utils.fromAscii(''), 64), topUpErrors.invalidByte32);
    });
    it('should revert if customer address is ZERO ADDRESS', async () => {
      await registerForRevert('customerAddress', ZERO_ADDRESS, topUpErrors.zeroAddress);
    });
    it('should revert if pull payment executor address is ZERO ADDRESS', async () => {
      await registerForRevert('pullPaymentExecutorAddress', ZERO_ADDRESS, topUpErrors.zeroAddress);
    });
    it('should revert if treasury address is ZERO ADDRESS', async () => {
      await registerForRevert('treasuryAddress', ZERO_ADDRESS, topUpErrors.zeroAddress);
    });
    it('should revert if initial conversion rate is zero', async () => {
      await registerForRevert('initialConversionRate', 0, topUpErrors.lessThanZero);
    });
    it('should revert if initial conversion rate too high', async () => {
      await registerForRevert('initialConversionRate', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if initial payment amount is zero', async () => {
      await registerForRevert('initialPaymentAmountInCents', 0, topUpErrors.lessThanZero);
    });
    it('should revert if initial payment amount too high', async () => {
      await registerForRevert('initialPaymentAmountInCents', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if top up amount is zero', async () => {
      await registerForRevert('topUpAmountInCents', 0, topUpErrors.lessThanZero);
    });
    it('should revert if top up amount too high', async () => {
      await registerForRevert('topUpAmountInCents', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if start timestamp is zero', async () => {
      await registerForRevert('startTimestamp', 0, topUpErrors.lessThanZero);
    });
    it('should revert if start timestamp too high', async () => {
      await registerForRevert('startTimestamp', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if total limit is zero', async () => {
      await registerForRevert('totalLimit', 0, topUpErrors.lessThanZero);
    });
    it('should revert if total limit is too high', async () => {
      await registerForRevert('totalLimit', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if the currency is empty', async () => {
      await registerForRevert('currency', '', topUpErrors.emptyString);
    });
    it('should revert if the signature from the customer doesn\'t match', async () => {
      const signature = await calcSignedMessageForTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      const anotherTopUpAmount = 10000; // 100 FIAT

      await assertRevert(
        pumaPayPullPayment.registerPullPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          [ topUpPayment.paymentID, topUpPayment.businessID ],
          [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
          [
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents,
            anotherTopUpAmount, topUpPayment.startTimestamp, topUpPayment.totalLimit
          ],
          topUpPayment.currency,
          {
            from: executor
          }),
        topUpErrors.invalidSignatureForRegistration
      );
    });
    it('should emit a "LogPaymentRegistered" event ', async () => {
      const pumaPayPullPaymentRegistration = await registerPullPayment();
      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogPaymentRegistered');
      logs[ 1 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 1 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      logs[ 1 ].args.businessID.should.be.equal(topUpPayment.businessID);
    });
    it('should emit a "LogPullPaymentExecuted" event ', async () => {
      const pumaPayPullPaymentRegistration = await registerPullPayment();
      const logs = pumaPayPullPaymentRegistration.logs;

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(topUpPayment.businessID);
      compareBigNumbers(logs[ 0 ].args.amountInPMA, treasuryBalanceAfter);
      compareBigNumbers(logs[ 0 ].args.amountInPMA, expectedAmountOfPmaTransferred);
      compareBigNumbers(logs[ 0 ].args.conversionRate, topUpPayment.initialConversionRate);
    });
  });

  describe('Execute top up pull payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a new pull payment', async () => {
      await registerPullPayment();
    });
    it('should transfer PMA to the treasury wallet', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferredOnRegistration =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));
      const expectedAmountOfPmaTransferredOnExecution =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.topUpAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));
      const totalPmaTransferred =
        web3.utils.toBN(expectedAmountOfPmaTransferredOnRegistration).add(web3.utils.toBN(expectedAmountOfPmaTransferredOnExecution));

      compareBigNumbers(treasuryBalanceAfter, totalPmaTransferred);
    });
    it('should update the last payment timestamp', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const ethDate = await currentBlockTime();
      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);

      compareBigNumbers(pullPaymentInArray.lastPaymentTimestamp, ethDate);
    });
    it('should update the total spent amount', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);

      compareBigNumbers(pullPaymentInArray.totalSpent, topUpPayment.topUpAmountInCents);
    });
    it('should revert if not called by the pull payment executor', async () => {
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.treasuryAddress
        }),
        topUpErrors.notPullPaymentExecutor
      );
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.notPullPaymentExecutor
      );
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: owner
        }),
        topUpErrors.notPullPaymentExecutor
      );
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: executor
        }),
        topUpErrors.notPullPaymentExecutor
      );
    });
    it('should revert if the payment does not exists', async () => {
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(web3.utils.padRight(web3.utils.fromAscii('WRONG_PAYMENT_ID'), 64), EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.paymentNotExists
      );
    });
    it('should revert if conversion rate is too high - OVERFLOW LIMITS', async () => {
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if conversion rate is ZERO', async () => {
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, 0, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should emit a "LogPullPaymentExecuted" event', async () => {
      const pumaPayPullPaymentExecution = await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });
      const logs = pumaPayPullPaymentExecution.logs;

      const expectedAmountOfPmaTransferredOnExecution =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.topUpAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(topUpPayment.businessID);
      compareBigNumbers(logs[ 0 ].args.amountInPMA, expectedAmountOfPmaTransferredOnExecution);
      compareBigNumbers(logs[ 0 ].args.conversionRate, EUR_EXCHANGE_RATE);
    });
  });

  describe('Execute a top up pull payment - TOTAL LIMITS', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should fail to execute the top up if the total limits have been reached', async () => {
      for (let i = 0; i < numberOfTotalAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }

      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        })
      );
    });
  });

  describe('Cancel a top up pull payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the cancel timestamp', async () => {
      await cancelPullPayment();

      const ethDate = await currentBlockTime();
      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);

      compareBigNumbers(pullPaymentInArray.lastPaymentTimestamp, ethDate);
    });
    it('should not allow for a top up to be executed after a payment is cancelled', async () => {
      await cancelPullPayment();

      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.paymentCancelled
      );
    });
    it('should revert if the payment doesn\'t exist', async () => {
      await cancelForRevert('paymentID', web3.utils.padRight(web3.utils.fromAscii('WRONG_PAYMENT_ID'), 64), topUpErrors.paymentNotExists);
    });
    it('should revert if the payment is already cancelled', async () => {
      await cancelPullPayment();

      await assertRevert(
        cancelPullPayment(),
        topUpErrors.paymentCancelled
      );
    });
    it('should revert if not called by an executor', async () => {
      const signature = await calcSignedMessageForTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(
        pumaPayPullPayment.cancelTopUpPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          topUpPayment.paymentID,
          {
            from: treasuryAddress
          }),
        topUpErrors.notExecutor
      );
      await assertRevert(
        pumaPayPullPayment.cancelTopUpPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          topUpPayment.paymentID,
          {
            from: owner
          }),
        topUpErrors.notExecutor
      );
    });
    it('should emit a "LogPaymentCancelled" event', async () => {
      const cancellationResult = await cancelPullPayment();
      const logs = cancellationResult.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentCancelled');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(topUpPayment.businessID);
    });
  });

  describe('Updating total limits for payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the total limit for the payment', async () => {
      const newLimit = 12000; // 120 FIAT
      await pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });
      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);
      compareBigNumbers(pullPaymentInArray.totalLimit, newLimit);
    });

    it('should be able to execute a pull payment when the total limit is increased', async () => {
      // 1: Reach the limit
      for (let i = 0; i < numberOfTotalAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }

      // 2: Make sure the execution won't happen if the total limit is reached
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.totalLimitsReached
      );
      // 3: Update the limit
      const newLimit = 12000; // 120 FIAT
      await pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });
      // 4: Execution must happen
      const treasuryBalanceBefore = await token.balanceOf(topUpPayment.treasuryAddress);

      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const transferredAmount = treasuryBalanceAfter.sub(treasuryBalanceBefore);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.topUpAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      compareBigNumbers(transferredAmount, expectedAmountOfPmaTransferred);
    });
    it('should not allow for a pull payment to be executed when the limit is decreased', async () => {
      // 1: Execute multiple pull payments
      for (let i = 0; i < numberOfTotalAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }

      // 2. The execution should fail
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.totalLimitsReached
      );
    });
    it('should revert if not executed from the customer for that payment', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.treasuryAddress
        }),
        topUpErrors.notCustomer
      );
    });
    it('should revert if the number is zero', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, 0, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the number is higher than the overflow limit', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if the number is lower or equal to the amount spent', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });
      const totalSpent = ( await pumaPayPullPayment.pullPayments(topUpPayment.paymentID) ).totalSpent;
      await assertRevert(
        pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, ( totalSpent - 1 ), {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.invalidTotalLimit
      );
    });
    it('should emit "LogTotalLimitUpdated" event', async () => {
      const newLimit = 12000; // 120 FIAT
      const updateResult = await pumaPayPullPayment.updateTotalLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogTotalLimitUpdated');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 0 ].args.oldLimit, topUpPayment.totalLimit);
      compareBigNumbers(logs[ 0 ].args.newLimit, newLimit);
    });
  });

  describe('Retrieve limits', async () => {
    let topUpPaymentsExecuted = 0;
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    beforeEach('execute a few pull payments within the limits', async () => {
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.totalLimit / topUpPayment.topUpAmountInCents ));
      const numberOfTopUpsNotExecuted = Math.floor(( numberOfAllowedTopUps / 2 ));
      topUpPaymentsExecuted = numberOfAllowedTopUps - numberOfTopUpsNotExecuted;

      for (let i = 0; i < topUpPaymentsExecuted; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
    });
    it('should return the total limit for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveTotalLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.totalLimit, topUpPayment.totalLimit);
    });
    it('should return the total spent for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveTotalLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.totalSpent, topUpPayment.topUpAmountInCents * topUpPaymentsExecuted);
    });
    it('should return ZERO values if the payment doesn\'t exists', async () => {
      const limits = await pumaPayPullPayment.retrieveTotalLimits(web3.utils.padRight(web3.utils.fromAscii('OTHER_PAYMENT'), 64));

      compareBigNumbers(limits.totalLimit, 0);
      compareBigNumbers(limits.totalSpent, 0);
    });
  });

  describe('Executors Funding', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('empty owner wallet', async () => {
      const ownerBalance = await web3.eth.getBalance(owner);
      const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
      await transferETH(( ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), owner, deployerAccount);
    });
    beforeEach('empty executors wallet', async () => {
      const executorBalance = await web3.eth.getBalance(executor);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await transferETH(( executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), executor, deployerAccount);
    });
    beforeEach('empty second executor wallet', async () => {
      const executorBalance = await web3.eth.getBalance(secondExecutor);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await transferETH(( executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), secondExecutor, deployerAccount);
    });
    afterEach('transfer some ETH back to owner', async () => {
      await transferETH(( 5 - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), deployerAccount, owner);
    });
    afterEach('transfer some ETH back to first executor', async () => {
      await transferETH(( 5 - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), deployerAccount, executor);
    });
    afterEach('transfer some ETH back to second executor', async () => {
      await transferETH(( 5 - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), deployerAccount, secondExecutor);
    });
    it('should fund the executor on registration', async () => {
      const executorBalanceBefore = await web3.eth.getBalance(executor);
      const transaction = await registerPullPayment();

      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const executorBalanceAfter = await web3.eth.getBalance(executor);

      const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));

      compareBigNumbers(expectedBalance, FUNDING_AMOUNT);
    });
    it('should emit a "LogSmartContractActorFunded" event when the executor is funded on registration', async () => {
      const transaction = await registerPullPayment();

      const logs = transaction.logs;
      const ethDate = await currentBlockTime();

      assert.equal(logs.length, 3);
      assert.equal(logs[ 1 ].event, 'LogSmartContractActorFunded');
      logs[ 1 ].args.actorRole.should.be.equal('executor');
      logs[ 1 ].args.actor.should.be.equal(executor);
      compareBigNumbers(logs[ 1 ].args.timestamp, ethDate);
    });
    it('should fund the executor on cancellation', async () => {
      await registerPullPayment();
      const executorBalance = await web3.eth.getBalance(executor);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await transferETH(( executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), executor, deployerAccount);

      const executorBalanceBefore = await web3.eth.getBalance(executor);
      const transaction = await cancelPullPayment();

      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const executorBalanceAfter = await web3.eth.getBalance(executor);
      const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));

      compareBigNumbers(expectedBalance, FUNDING_AMOUNT);
    });
    it('should emit a "LogSmartContractActorFunded" event when the executor is funded on cancellation', async () => {
      await registerPullPayment();
      const executorBalance = await web3.eth.getBalance(executor);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await transferETH(( executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), executor, deployerAccount);

      const transaction = await cancelPullPayment();

      const logs = transaction.logs;
      const ethDate = await currentBlockTime();

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogSmartContractActorFunded');
      logs[ 0 ].args.actorRole.should.be.equal('executor');
      logs[ 0 ].args.actor.should.be.equal(executor);
      compareBigNumbers(logs[ 0 ].args.timestamp, ethDate);
    });
    it('should fund the owner on adding a new executor', async () => {
      const ownerBalanceBefore = await web3.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const ownerBalanceAfter = await web3.eth.getBalance(owner);
      const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
      compareBigNumbers(expectedBalance, FUNDING_AMOUNT);
    });
    it('should fund the new executor when is low in ETH', async () => {
      const executorBalanceBefore = await web3.eth.getBalance(secondExecutor);
      await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });
      const executorBalanceAfter = await web3.eth.getBalance(secondExecutor);
      const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore));
      compareBigNumbers(expectedBalance, FUNDING_AMOUNT);
    });
    it('should emit a "LogSmartContractActorFunded" event when the owner is funded on adding new executor', async () => {
      const transaction = await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });

      const logs = transaction.logs;
      const ethDate = await currentBlockTime();

      assert.equal(logs.length, 3);
      assert.equal(logs[ 0 ].event, 'LogSmartContractActorFunded');
      logs[ 0 ].args.actorRole.should.be.equal('executor');
      logs[ 0 ].args.actor.should.be.equal(secondExecutor);
      compareBigNumbers(logs[ 0 ].args.timestamp, ethDate);
    });
    it('should emit a "LogSmartContractActorFunded" event when the executor is funded on adding new executor', async () => {
      const transaction = await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });

      const logs = transaction.logs;
      const ethDate = await currentBlockTime();

      assert.equal(logs.length, 3);
      assert.equal(logs[ 1 ].event, 'LogSmartContractActorFunded');
      logs[ 1 ].args.actorRole.should.be.equal('owner');
      logs[ 1 ].args.actor.should.be.equal(owner);
      compareBigNumbers(logs[ 1 ].args.timestamp, ethDate);
    });
    it('should fund the owner on removing an executor', async () => {
      await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });

      const ownerBalance = await web3.eth.getBalance(owner);
      const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
      await transferETH(( ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), owner, deployerAccount);

      const ownerBalanceBefore = await web3.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.removeExecutor(secondExecutor, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const ownerBalanceAfter = await web3.eth.getBalance(owner);
      const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));

      compareBigNumbers(expectedBalance, FUNDING_AMOUNT);
    });
    it('should emit a "LogSmartContractActorFunded" event when the owner is funded on removing an executor', async () => {
      await pumaPayPullPayment.addExecutor(secondExecutor, {
        from: owner
      });
      const ownerBalance = await web3.eth.getBalance(owner);
      const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
      await transferETH(( ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS ), owner, deployerAccount);

      const transaction = await pumaPayPullPayment.removeExecutor(secondExecutor, {
        from: owner
      });
      const logs = transaction.logs;
      const ethDate = await currentBlockTime();

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogSmartContractActorFunded');
      logs[ 0 ].args.actorRole.should.be.equal('owner');
      logs[ 0 ].args.actor.should.be.equal(owner);
      compareBigNumbers(logs[ 0 ].args.timestamp, ethDate);
    });
  });
});
