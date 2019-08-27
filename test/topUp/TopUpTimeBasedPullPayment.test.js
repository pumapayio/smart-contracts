const {assertRevert} = require('../helpers/assertionHelper');
const {
  calcSignedMessageForTimeBasedTopUpRegistration,
  calcSignedMessageForTimeBasedTopUpCancellation,
  getVRS
} = require('../helpers/signatureHelpers');
const {topUpErrors} = require('../helpers/errorHelpers');
const {transferETH} = require('../helpers/tranfserHelper');
const {compareBigNumbers} = require('../helpers/comparisonHelper');
const {timeTravel, currentBlockTime} = require('../helpers/timeHelper');

const PumaPayToken = artifacts.require('MockMintableToken');
const PumaPayPullPayment = artifacts.require('TopUpTimeBasedPullPayment');

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
const TIME_BASED_LIMIT = 2000; // 20 FIAT
const TIME_BASED_PERIOD = DAY;

const CLIENT_PRIVATE_KEY = '0xc929da34af736b0f97ed3622980d8af51f762188f12e575f46fccdcf687ced66';

contract('Time Based Top Up Pull Payment Smart Contract', (accounts) => {
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
    totalLimit: TOTAL_LIMIT,
    timeBasedLimit: TIME_BASED_LIMIT,
    timeBasedPeriod: TIME_BASED_PERIOD
  };

  const numberOfTotalAllowedTopUps = Math.floor(( topUpPayment.totalLimit / topUpPayment.topUpAmountInCents ));
  const numberOfTimeBasedAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));

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
    const signature = await calcSignedMessageForTimeBasedTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    const result = await pumaPayPullPayment.registerPullPayment(
      sigVRS.v,
      sigVRS.r,
      sigVRS.s,
      [ topUpPayment.paymentID, topUpPayment.businessID ],
      [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
      [
        topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents, topUpPayment.topUpAmountInCents,
        topUpPayment.startTimestamp, topUpPayment.totalLimit, topUpPayment.timeBasedLimit, topUpPayment.timeBasedPeriod
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

    const signature = await calcSignedMessageForTimeBasedTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
    const sigVRS = await getVRS(signature);

    await assertRevert(
      pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ topUpPayment.paymentID, topUpPayment.businessID ],
        [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
        [
          topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents, topUpPayment.topUpAmountInCents,
          topUpPayment.startTimestamp, topUpPayment.totalLimit, topUpPayment.timeBasedLimit, topUpPayment.timeBasedPeriod
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
    const signature = await calcSignedMessageForTimeBasedTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
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

    const signature = await calcSignedMessageForTimeBasedTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
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
      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

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
      // Time based checks
      compareBigNumbers(timeBasedLimitsInArray.limit, topUpPayment.timeBasedLimit);
      compareBigNumbers(timeBasedLimitsInArray.period, topUpPayment.timeBasedPeriod);
      compareBigNumbers(timeBasedLimitsInArray.spent, 0);
      compareBigNumbers(timeBasedLimitsInArray.setTimestamp, 0);
    });

    it('should transfer the PMA for the initial payment', async () => {
      await registerPullPayment();

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      compareBigNumbers(treasuryBalanceAfter, expectedAmountOfPmaTransferred);
    });

    it('should revert if not called by one of the executors', async () => {
      const signature = await calcSignedMessageForTimeBasedTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(
        pumaPayPullPayment.registerPullPayment(
          sigVRS.v,
          sigVRS.r,
          sigVRS.s,
          [ topUpPayment.paymentID, topUpPayment.businessID ],
          [ topUpPayment.customerAddress, topUpPayment.pullPaymentExecutorAddress, topUpPayment.treasuryAddress ],
          [
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents, topUpPayment.topUpAmountInCents,
            topUpPayment.startTimestamp, topUpPayment.totalLimit, topUpPayment.timeBasedLimit, topUpPayment.timeBasedPeriod
          ],
          topUpPayment.currency,
          {
            from: owner
          }),
        topUpErrors.notExecutor
      );
    });
    it('should revert if you try to register the same payment twice', async () => {
      const signature = await calcSignedMessageForTimeBasedTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
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
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents, topUpPayment.topUpAmountInCents,
            topUpPayment.startTimestamp, topUpPayment.totalLimit, topUpPayment.timeBasedLimit, topUpPayment.timeBasedPeriod
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
    it('should revert if time based limit is zero', async () => {
      await registerForRevert('timeBasedLimit', 0, topUpErrors.lessThanZero);
    });
    it('should revert if time based limit is too high', async () => {
      await registerForRevert('timeBasedLimit', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if time based period is zero', async () => {
      await registerForRevert('timeBasedPeriod', 0, topUpErrors.lessThanZero);
    });
    it('should revert if time based period is too high', async () => {
      await registerForRevert('timeBasedPeriod', OVERFLOW_CHECK, topUpErrors.higherThanOverflow);
    });
    it('should revert if the currency is empty', async () => {
      await registerForRevert('currency', '', topUpErrors.emptyString);
    });
    it('should revert if the signature from the customer doesn\'t match', async () => {
      const signature = await calcSignedMessageForTimeBasedTopUpRegistration(topUpPayment, CLIENT_PRIVATE_KEY);
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
            topUpPayment.initialConversionRate, topUpPayment.initialPaymentAmountInCents, anotherTopUpAmount,
            topUpPayment.startTimestamp, topUpPayment.totalLimit, topUpPayment.timeBasedLimit, topUpPayment.timeBasedPeriod
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
    it('should update the time based spent', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimitsInArray.spent, topUpPayment.topUpAmountInCents);
    });
    it('should update the time based timestamp', async () => {
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const ethDate = await currentBlockTime();
      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimitsInArray.setTimestamp, ethDate);
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
        // console.log('PAYMENT NO.', i);
        if (( i ) % ( numberOfTimeBasedAllowedTopUps ) === 0) {
          // console.log('time traveling...', ( topUpPayment.timeBasedPeriod ) / DAY, 'days');
          await timeTravel(topUpPayment.timeBasedPeriod + 10);
        }

        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });

        // const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);
        // const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
        // console.log('TOTAL SPENT', String(pullPaymentInArray.totalSpent));
        // console.log('TIME BASED SPENT', String(timeBasedLimitsInArray.spent));
        // console.log('TIME BASED TS', String(timeBasedLimitsInArray.setTimestamp));
      }

      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        })
      );
    });
  });

  describe('Execute a top up pull payment - TIME BASED LIMITS', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    it('should allow for top up pull payments if we are below the time based limits', async () => {
      await registerPullPayment();
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));
      const conversionRate = EUR_EXCHANGE_RATE;
      for (let i = 0; i < numberOfAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, conversionRate, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferredOnRegistration =
        web3.utils.toWei(String(
          DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / topUpPayment.initialConversionRate / FIAT_TO_CENT_FIXER)
        );
      const expectedAmountOfPmaTransferredOnExecution =
        web3.utils.toWei(String(
          numberOfAllowedTopUps * DECIMAL_FIXER * topUpPayment.topUpAmountInCents / conversionRate / FIAT_TO_CENT_FIXER)
        );
      const totalPmaTransferred = web3.utils.toBN(expectedAmountOfPmaTransferredOnRegistration).add(web3.utils.toBN(expectedAmountOfPmaTransferredOnExecution));

      compareBigNumbers(treasuryBalanceAfter, totalPmaTransferred);
    });
    it('should update the time based spent amount', async () => {
      await registerPullPayment();
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));

      for (let i = 0; i < numberOfAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
        const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

        compareBigNumbers(timeBasedLimitsInArray.spent, ( ( i + 1 ) * topUpPayment.topUpAmountInCents ));
      }
    });
    it('should revert if the time based limit is reached', async () => {
      await registerPullPayment();
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));

      for (let i = 0; i < numberOfAllowedTopUps; i++) {
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
    it('should update the time based set timestamp when the next top up is after the period set by the customer', async () => {
      await registerPullPayment();
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));

      for (let i = 0; i < numberOfAllowedTopUps - 1; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
      timeTravel(topUpPayment.timeBasedPeriod + 1);
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const ethDate = await currentBlockTime();
      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimitsInArray.setTimestamp, ethDate);
    });
    it('should update the time based spent amount when the next top up is after the period set by the customer', async () => {
      await registerPullPayment();
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));

      for (let i = 0; i < numberOfAllowedTopUps - 2; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
      timeTravel(topUpPayment.timeBasedPeriod + 1);
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });

      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimitsInArray.spent, topUpPayment.topUpAmountInCents);
    });
    it('should transfer correct amount when the next top up is after the period set by the customer', async () => {
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));
      const numberOfTopUpsNotExecuted = Math.floor(( numberOfAllowedTopUps / 2 ));
      let totalNumberOfTopUps = 0;

      await registerPullPayment();
      for (let i = 0; i < numberOfAllowedTopUps - numberOfTopUpsNotExecuted; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
        totalNumberOfTopUps++;
      }
      timeTravel(topUpPayment.timeBasedPeriod + 1);
      for (let i = 0; i < numberOfAllowedTopUps - numberOfTopUpsNotExecuted; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
        totalNumberOfTopUps++;
      }

      const treasuryBalanceAfter = await token.balanceOf(topUpPayment.treasuryAddress);
      const expectedAmountOfPmaTransferredOnRegistration =
        web3.utils.toWei(String(DECIMAL_FIXER * topUpPayment.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));
      const expectedAmountOfPmaTransferredOnExecution =
        web3.utils.toWei(String(totalNumberOfTopUps * DECIMAL_FIXER * topUpPayment.topUpAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));
      const totalPmaTransferred = web3.utils.toBN(expectedAmountOfPmaTransferredOnRegistration).add(web3.utils.toBN(expectedAmountOfPmaTransferredOnExecution));

      compareBigNumbers(treasuryBalanceAfter, totalPmaTransferred);
    });
    it('should update the set timestamp when the next top up is after the period set by the customer', async () => {
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));
      const numberOfTopUpsNotExecuted = Math.floor(( numberOfAllowedTopUps / 2 ));
      let totalNumberOfTopUps = numberOfAllowedTopUps - numberOfTopUpsNotExecuted;

      await registerPullPayment();
      for (let i = 0; i < totalNumberOfTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
      timeTravel(topUpPayment.timeBasedPeriod + 1);
      for (let i = 0; i < totalNumberOfTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }

      const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimitsInArray.spent, ( totalNumberOfTopUps * topUpPayment.topUpAmountInCents ));
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
      const signature = await calcSignedMessageForTimeBasedTopUpCancellation(topUpPayment.paymentID, topUpPayment.businessID, CLIENT_PRIVATE_KEY);
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
        // console.log('PAYMENT NO.', i);
        if (( i ) % ( numberOfTimeBasedAllowedTopUps ) === 0) {
          // console.log('time traveling...', ( topUpPayment.timeBasedPeriod ) / DAY, 'days');
          await timeTravel(topUpPayment.timeBasedPeriod + 10);
        }

        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
        // const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);
        // const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
        // console.log('TOTAL SPENT', String(pullPaymentInArray.totalSpent));
        // console.log('TIME BASED SPENT', String(timeBasedLimitsInArray.spent));
        // console.log('TIME BASED TS', String(timeBasedLimitsInArray.setTimestamp));
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
      // 4: Time travel for a day to pass the time based limit
      await timeTravel(topUpPayment.timeBasedPeriod + 10);
      // 5: Execution must happen
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
        // console.log('PAYMENT NO.', i);
        if (( i ) % ( numberOfTimeBasedAllowedTopUps ) === 0) {
          // console.log('time traveling...', ( topUpPayment.timeBasedPeriod ) / DAY, 'days');
          await timeTravel(topUpPayment.timeBasedPeriod + 10);
        }

        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });

        // const pullPaymentInArray = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);
        // const timeBasedLimitsInArray = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
        // console.log('TOTAL SPENT', String(pullPaymentInArray.totalSpent));
        // console.log('TIME BASED SPENT', String(timeBasedLimitsInArray.spent));
        // console.log('TIME BASED TS', String(timeBasedLimitsInArray.setTimestamp));
      }

      // 3. The execution should fail
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

  describe('Updating time based limits for payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the time based limit for the payment', async () => {
      const newLimit = 4000; // 40 FIAT
      await pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.limit, newLimit);
    });
    it('should execute pull payments when the time based limit is increased', async () => {
      let spentWithinTimePeriod = 0;
      // 1: Execute pull payments to reach the time based limit
      for (let i = 0; i < numberOfTimeBasedAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
        spentWithinTimePeriod += topUpPayment.topUpAmountInCents;
      }
      // 2: It should revert when time based limits are reached
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.timeBasedLimitsReached
      );
      // 3: Increase time based limit
      const newLimit = 4000; // 40 FIAT
      await pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });

      // 4: Execution should take place
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });
      spentWithinTimePeriod += topUpPayment.topUpAmountInCents;
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimits.spent, spentWithinTimePeriod);
    });
    it('should revert if not executed from the customer for that payment', async () => {
      const newLimit = 4000; // 40 FIAT
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, newLimit, {
          from: topUpPayment.treasuryAddress
        }),
        topUpErrors.notCustomer
      );
    });
    it('should revert if the number is zero', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, 0, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the number is higher than the overflow limit', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if the number is lower than the amount spent', async () => {

      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should emit "LogTimeBasedLimitUpdated" event', async () => {
      const newLimit = 12000; // 120 FIAT
      const updateResult = await pumaPayPullPayment.updateTimeBasedLimit(topUpPayment.paymentID, newLimit, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogTimeBasedLimitUpdated');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 0 ].args.oldLimit, topUpPayment.timeBasedLimit);
      compareBigNumbers(logs[ 0 ].args.newLimit, newLimit);
    });
  });

  describe('Updating time based period for payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the time based period for the payment', async () => {
      const newPeriod = 2 * DAY; // 2 Days
      await pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, newPeriod, {
        from: topUpPayment.customerAddress
      });

      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.period, newPeriod);
    });
    it('should update the time based period for the payment with a high reasonable value i.e. 1 Century', async () => {
      const newPeriod = 100 * ( 365 * DAY ); // 100 Years
      await pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, newPeriod, {
        from: topUpPayment.customerAddress
      });

      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.period, newPeriod);
    });
    it('should execute pull payments when the time based period is decreased', async () => {
      // 1: Execute pull payments to reach the time based limit
      for (let i = 0; i < numberOfTimeBasedAllowedTopUps; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
      // 2: It should revert when time based limits are reached
      await assertRevert(
        pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.timeBasedLimitsReached
      );
      // 3: Decrease the time based period
      const newPeriod = 0.5 * DAY; // 40 FIAT
      await pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, newPeriod, {
        from: topUpPayment.customerAddress
      });
      // 4: Time travel half a day - new time based period
      await timeTravel(newPeriod + 1);
      // 4: Execution should take place
      await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
        from: topUpPayment.pullPaymentExecutorAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);

      compareBigNumbers(timeBasedLimits.spent, topUpPayment.topUpAmountInCents);
    });
    it('should revert if not executed from the customer for that payment', async () => {
      const newPeriod = 2 * DAY; // 2 Days
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, newPeriod, {
          from: topUpPayment.treasuryAddress
        }),
        topUpErrors.notCustomer
      );
    });
    it('should revert if the period is zero', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, 0, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the period is higher than the overflow limit', async () => {
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, OVERFLOW_CHECK, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should emit "LogTimeBasedPeriodUpdated" event', async () => {
      const newPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateTimeBasedPeriod(topUpPayment.paymentID, newPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogTimeBasedPeriodUpdated');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 0 ].args.oldPeriod, topUpPayment.timeBasedPeriod);
      compareBigNumbers(logs[ 0 ].args.newPeriod, newPeriod);
    });
  });

  describe('Updating time based limit and period for payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the time based period for the payment', async () => {
      const newLimit = 12000; // 120 FIAT
      const newPeriod = 2 * DAY; // 2 Days

      await pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, newPeriod, {
        from: topUpPayment.customerAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.period, newPeriod);
    });
    it('should update the time based limit for the payment', async () => {
      const newLimit = 12000; // 120 FIAT
      const newPeriod = 2 * DAY; // 2 Days

      await pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, newPeriod, {
        from: topUpPayment.customerAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.limit, newLimit);
    });
    it('should revert if not executed from the customer for that payment', async () => {
      const newLimit = 12000; // 120 FIAT
      const newPeriod = 2 * DAY; // 2 Days
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, newPeriod, {
          from: topUpPayment.treasuryAddress
        }),
        topUpErrors.notCustomer
      );
    });
    it('should revert if the period is zero', async () => {
      const newLimit = 12000; // 120 FIAT
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, 0, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the period is higher than the overflow limit', async () => {
      const newLimit = 12000; // 120 FIAT
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, OVERFLOW_CHECK, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if the limit is zero', async () => {
      const newPeriod = 2 * DAY; // 2 Days
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, 0, newPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the limit is higher than the overflow limit', async () => {
      const newPeriod = 2 * DAY; // 2 Days
      await assertRevert(
        pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, OVERFLOW_CHECK, newPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should emit "LogTimeBasedLimitUpdated" event', async () => {
      const newLimit = 12000; // 120 FIAT
      const newPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, newPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogTimeBasedLimitUpdated');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 0 ].args.oldLimit, topUpPayment.timeBasedLimit);
      compareBigNumbers(logs[ 0 ].args.newLimit, newLimit);
    });
    it('should emit "LogTimeBasedPeriodUpdated" event', async () => {
      const newLimit = 12000; // 120 FIAT
      const newPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateTimeBasedLimitAndPeriod(topUpPayment.paymentID, newLimit, newPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogTimeBasedPeriodUpdated');
      logs[ 1 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 1 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 1 ].args.oldPeriod, topUpPayment.timeBasedPeriod);
      compareBigNumbers(logs[ 1 ].args.newPeriod, newPeriod);
    });
  });

  describe('Updating all limits for a top up payment', () => {
    beforeEach('prepare smart contracts - approve() & transfer ETH & addExecutor()', async () => {
      await prepareSmartContract();
    });
    beforeEach('register a pull payment', async () => {
      await registerPullPayment();
    });
    it('should update the total limit', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });
      const pullPayment = await pumaPayPullPayment.pullPayments(topUpPayment.paymentID);
      compareBigNumbers(pullPayment.totalLimit, newTotalLimit);
    });
    it('should update the time based limit', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 12000; // 120 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.limit, newTimeBasedLimit);
    });
    it('should update the time based period', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });
      const timeBasedLimits = await pumaPayPullPayment.timeBasedLimits(topUpPayment.paymentID);
      compareBigNumbers(timeBasedLimits.period, newTimeBasedPeriod);
    });
    it('should revert if not executed by the customer', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.pullPaymentExecutorAddress
        }),
        topUpErrors.notCustomer
      );
    });
    it('should revert if the new total limit is ZERO', async () => {
      const newTotalLimit = 0;
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days
      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the new total limit is above the overflow limit', async () => {
      const newTotalLimit = OVERFLOW_CHECK;
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if the new time based limit is ZERO', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 0;
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the new time based limit is above the overflow limit', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = OVERFLOW_CHECK;
      const newTimeBasedPeriod = 2 * DAY; // 2 Days

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should revert if the new time based period is ZERO', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 0;

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.lessThanZero
      );
    });
    it('should revert if the new time based period is above the overflow limit', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = OVERFLOW_CHECK;

      await assertRevert(
        pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
          from: topUpPayment.customerAddress
        }),
        topUpErrors.higherThanOverflow
      );
    });
    it('should emit "LogTotalLimitUpdated" event', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;
      assert.equal(logs.length, 3);
      assert.equal(logs[ 0 ].event, 'LogTotalLimitUpdated');
      logs[ 0 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 0 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 0 ].args.oldLimit, topUpPayment.totalLimit);
      compareBigNumbers(logs[ 0 ].args.newLimit, newTotalLimit);
    });
    it('should emit "LogTimeBasedLimitUpdated" event', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;
      assert.equal(logs.length, 3);
      assert.equal(logs[ 1 ].event, 'LogTimeBasedLimitUpdated');
      logs[ 1 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 1 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 1 ].args.oldLimit, topUpPayment.timeBasedLimit);
      compareBigNumbers(logs[ 1 ].args.newLimit, newTimeBasedLimit);
    });
    it('should emit "LogTimeBasedPeriodUpdated" event', async () => {
      const newTotalLimit = 12000; // 120 FIAT
      const newTimeBasedLimit = 1200; // 12 FIAT
      const newTimeBasedPeriod = 2 * DAY; // 2 Days
      const updateResult = await pumaPayPullPayment.updateAllLimits(topUpPayment.paymentID, newTotalLimit, newTimeBasedLimit, newTimeBasedPeriod, {
        from: topUpPayment.customerAddress
      });

      const logs = updateResult.logs;
      assert.equal(logs.length, 3);
      assert.equal(logs[ 2 ].event, 'LogTimeBasedPeriodUpdated');
      logs[ 2 ].args.customerAddress.should.be.equal(topUpPayment.customerAddress);
      logs[ 2 ].args.paymentID.should.be.equal(topUpPayment.paymentID);
      compareBigNumbers(logs[ 2 ].args.oldPeriod, topUpPayment.timeBasedPeriod);
      compareBigNumbers(logs[ 2 ].args.newPeriod, newTimeBasedPeriod);
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
    beforeEach('execute a few pull payments within the time based limits', async () => {
      const numberOfAllowedTopUps = Math.floor(( topUpPayment.timeBasedLimit / topUpPayment.topUpAmountInCents ));
      const numberOfTopUpsNotExecuted = Math.floor(( numberOfAllowedTopUps / 2 ));
      topUpPaymentsExecuted = numberOfAllowedTopUps - numberOfTopUpsNotExecuted;

      for (let i = 0; i < topUpPaymentsExecuted; i++) {
        await pumaPayPullPayment.executeTopUpPayment(topUpPayment.paymentID, EUR_EXCHANGE_RATE, {
          from: topUpPayment.pullPaymentExecutorAddress
        });
      }
    });
    it('should return the total limit for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.totalLimit, topUpPayment.totalLimit);
    });
    it('should return the total spent for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.totalSpent, topUpPayment.topUpAmountInCents * topUpPaymentsExecuted);
    });
    it('should return the time based limit for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.timeBasedLimit, topUpPayment.timeBasedLimit);
    });
    it('should return the time based spent for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.timeBasedSpent, topUpPayment.topUpAmountInCents * topUpPaymentsExecuted);
    });
    it('should return the time based period for the top up billing model based on the payment ID', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.timeBasedPeriod, topUpPayment.timeBasedPeriod);
    });
    it('should return zero time based spent if requested after the time based period', async () => {
      await timeTravel(topUpPayment.timeBasedPeriod + 1);
      const limits = await pumaPayPullPayment.retrieveLimits(topUpPayment.paymentID);
      compareBigNumbers(limits.timeBasedSpent, 0);
    });
    it('should return ZERO values if the payment doesn\'t exists', async () => {
      const limits = await pumaPayPullPayment.retrieveLimits(web3.utils.padRight(web3.utils.fromAscii('OTHER_PAYMENT'), 64));

      compareBigNumbers(limits.totalLimit, 0);
      compareBigNumbers(limits.totalSpent, 0);
      compareBigNumbers(limits.timeBasedLimit, 0);
      compareBigNumbers(limits.timeBasedSpent, 0);
      compareBigNumbers(limits.timeBasedPeriod, 0);
    });
  });

  describe('Executor/Owner Funding', () => {
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
