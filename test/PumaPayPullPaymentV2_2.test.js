const {assertRevert} = require('./helpers/assertionHelper');
const {transferETH} = require('./helpers/tranfserHelper');
const {timeTravel, currentBlockTime} = require('./helpers/timeHelper');
const {
  signRegistrationV2_2,
  signDeletionV2_2,
  getVRS
} = require('./helpers/signatureHelpers');
const PumaPayToken = artifacts.require('MockMintableToken');

const PumaPayPullPayment = artifacts.require('PumaPayPullPaymentV2_2');
const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const MINUTE = 60; // 60 seconds
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ONE_ETHER = web3.utils.toWei('1', 'ether');
const FUNDING_AMOUNT = web3.utils.toWei('0.5', 'ether');
const MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS = 0.15;
const MINTED_TOKENS = web3.utils.toWei('1000000000', 'ether'); // 1 Billion PMA
const DECIMAL_FIXER = 10 ** 10;
const FIAT_TO_CENT_FIXER = 100;
const EUR_EXCHANGE_RATE = 0.01 * DECIMAL_FIXER; // 1 PMA = 0.01 EUR
const USD_EXCHANGE_RATE = 0.02 * DECIMAL_FIXER; // 1 PMA = 0.02 USD

const CLIENT_ONE_PRIVATE_KEY = '0x581a2b62e840bae3e56685c5ede97d0cb1f252fa7937026dcac489074b01fc29';
const CLIENT_TWO_PRIVATE_KEY = '0xc5459c6743cd4fe5a89c3fc994c2bdfd5dbac6ecd750f642bd2e272d9fa0852d';
const CLIENT_THREE_PRIVATE_KEY = '0x7f201ee20596c003b979ba39018b08cd7920abbc04a9d1bb984aa8be421db541';

const GAS_PRICE = 1000000000;

contract('PumaPay Pull Payment V2.2 Contract', async (accounts) => {
  const deployerAccount = accounts[ 0 ];
  const owner = accounts[ 1 ];
  const executorOne = accounts[ 2 ];
  const executorTwo = accounts[ 3 ];
  const paymentExecutorOne = accounts[ 4 ];
  const paymentExecutorTwo = accounts[ 5 ];
  const paymentExecutorThree = accounts[ 6 ];
  const clientOne = accounts[ 7 ];
  const clientTwo = accounts[ 8 ];
  const clientThree = accounts[ 9 ];
  const treasuryAddress = accounts[ 10 ];

  let singlePullPayment = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
    uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_1'), 64),
    paymentType: web3.utils.padRight(web3.utils.fromAscii('2'), 64),
    client: clientOne,
    pullPaymentExecutorAddress: paymentExecutorOne,
    currency: 'EUR',
    initialConversionRate: EUR_EXCHANGE_RATE,
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 100000000, // 1 million in EUR cents
    frequency: 1,
    numberOfPayments: 1,
    startTimestamp: Math.floor(Date.now() / 1000) + DAY,
    treasuryAddress: treasuryAddress,
    trialPeriod: 0
  };

  let recurringPullPayment = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_2'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_2'), 64),
    uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_2'), 64),
    paymentType: web3.utils.padRight(web3.utils.fromAscii('3'), 64),
    client: clientTwo,
    pullPaymentExecutorAddress: paymentExecutorTwo,
    currency: 'USD',
    initialConversionRate: USD_EXCHANGE_RATE,
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000),
    treasuryAddress: treasuryAddress,
    trialPeriod: 0
  };

  let recurringWithInitialAmount = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_3'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_3'), 64),
    uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_3'), 64),
    paymentType: web3.utils.padRight(web3.utils.fromAscii('4'), 64),
    client: clientThree,
    pullPaymentExecutorAddress: paymentExecutorThree,
    currency: 'USD',
    initialConversionRate: USD_EXCHANGE_RATE,
    initialPaymentAmountInCents: 100, // 1.00 USD in cents
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000) + 2 * DAY,
    treasuryAddress: treasuryAddress,
    trialPeriod: 0
  };

  let recurringWithFreeTrial = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_4'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_4'), 64),
    uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_4'), 64),
    paymentType: web3.utils.padRight(web3.utils.fromAscii('5'), 64),
    client: clientThree,
    pullPaymentExecutorAddress: paymentExecutorThree,
    currency: 'USD',
    initialConversionRate: USD_EXCHANGE_RATE,
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000) + 2 * DAY,
    treasuryAddress: treasuryAddress,
    trialPeriod: DAY
  };

  let recurringWithPaidTrial = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_5'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_6'), 64),
    uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_6'), 64),
    paymentType: web3.utils.padRight(web3.utils.fromAscii('6'), 64),
    client: clientThree,
    pullPaymentExecutorAddress: paymentExecutorThree,
    currency: 'USD',
    initialConversionRate: USD_EXCHANGE_RATE,
    initialPaymentAmountInCents: 100, // 1.00 USD
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000) + 2 * DAY,
    treasuryAddress: treasuryAddress,
    trialPeriod: DAY
  };

  let token;
  let pumaPayPullPayment;

  beforeEach('Deploying new PumaPayToken', async () => {
    token = await PumaPayToken.new({
      from: deployerAccount
    });
  });

  beforeEach('Deploying new PumaPay Pull Payment', async () => {
    pumaPayPullPayment = await PumaPayPullPayment
      .new(token.address, {
        from: owner
      });
  });

  beforeEach('Issue tokens to the clients', async () => {
    const tokens = MINTED_TOKENS;
    await token.mint(clientOne, tokens, {
      from: deployerAccount
    });
    await token.mint(clientTwo, tokens, {
      from: deployerAccount
    });
    await token.mint(clientThree, tokens, {
      from: deployerAccount
    });
  });

  // describe('Deploying', async () => {
  //   it('PumaPay Pull Payment owner should be the address that was specified on contract deployment', async () => {
  //     const accountOwner = await pumaPayPullPayment.owner();
  //
  //     assert.equal(accountOwner.toString(), owner);
  //   });
  //
  //   it('PumaPay Pull Payment token should be the token address specified on contract deployment', async () => {
  //     const accountToken = await pumaPayPullPayment.token();
  //
  //     assert.equal(accountToken, token.address);
  //   });
  //
  //   it('PumaPay Pull Payment deployment should revert when the token is a ZERO address', async () => {
  //     await assertRevert(PumaPayPullPayment
  //       .new(ZERO_ADDRESS, {
  //         from: deployerAccount
  //       }));
  //   });
  // });

  // describe('Add executor', async () => {
  //   beforeEach('Transfer ETH to smart contract', async () => {
  //     await transferETH(1, deployerAccount, pumaPayPullPayment.address);
  //   });
  //
  //   it('should set the executor specified to true', async () => {
  //     await pumaPayPullPayment.addExecutor(executorOne,
  //       {
  //         from: owner
  //       });
  //     const executor = await pumaPayPullPayment.executors(executorOne);
  //
  //     assert.equal(executor, true);
  //   });
  //
  //   it('should NOT transfer ETHER to the executor account for paying gas fees if he holds enough funds', async () => {
  //     const executorBalanceBefore = await web3.eth.getBalance(executorOne);
  //     await pumaPayPullPayment.addExecutor(executorOne, {
  //       from: owner
  //     });
  //     const executorBalanceAfter = await web3.eth.getBalance(executorOne);
  //     const expectedBalance = web3.utils.fromWei(String(executorBalanceAfter), 'ether') - web3.utils.fromWei(String(executorBalanceBefore), 'ether');
  //
  //     assert.equal(String(expectedBalance), web3.utils.fromWei('0', 'ether'));
  //   });
  //
  //   it('should revert when the executor is a ZERO address', async () => {
  //     await assertRevert(
  //       pumaPayPullPayment.addExecutor(ZERO_ADDRESS, {
  //         from: owner
  //       })
  //     );
  //   });
  //
  //   it('should revert when adding the same executor', async () => {
  //     await pumaPayPullPayment.addExecutor(executorOne, {
  //       from: owner
  //     });
  //     await assertRevert(
  //       pumaPayPullPayment.addExecutor(executorOne, {
  //         from: owner
  //       })
  //     );
  //   });
  //
  //   it('should revert if NOT executed by the owner', async () => {
  //     await pumaPayPullPayment.addExecutor(executorOne, {
  //       from: owner
  //     });
  //
  //     await assertRevert(
  //       pumaPayPullPayment.addExecutor(executorTwo, {
  //         from: executorOne
  //       })
  //     );
  //   });
  // });

  // describe('Remove executor', async () => {
  //   beforeEach('Transfer ETH to smart contract', async () => {
  //     await transferETH(1, deployerAccount, pumaPayPullPayment.address);
  //   });
  //
  //   beforeEach('add an executor', async () => {
  //     await pumaPayPullPayment.addExecutor(executorOne, {
  //       from: owner
  //     });
  //   });
  //
  //   it('should set the executor specified to false', async () => {
  //     await pumaPayPullPayment.removeExecutor(executorOne, {
  //       from: owner
  //     });
  //     const executor = await pumaPayPullPayment.executors(executorOne);
  //
  //     assert.equal(executor, false);
  //   });
  //
  //   it('should revert when the executor is a ZERO address', async () => {
  //     await assertRevert(
  //       pumaPayPullPayment.removeExecutor(ZERO_ADDRESS, {
  //         from: owner
  //       })
  //     );
  //   });
  //
  //   it('should revert when the executor does not exists', async () => {
  //     await assertRevert(
  //       pumaPayPullPayment.removeExecutor(executorTwo, {
  //         from: owner
  //       })
  //     );
  //   });
  //
  //   it('should revert if NOT executed by the owner', async () => {
  //     await assertRevert(
  //       pumaPayPullPayment.removeExecutor(executorTwo, {
  //         from: executorOne
  //       })
  //     );
  //   });
  // });

  describe('Register Single Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from first client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
    });

    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        });

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(singlePullPayment.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(singlePullPayment.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(singlePullPayment.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.numberOfPayments - 1)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp + singlePullPayment.frequency)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate)));
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(singlePullPayment.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(singlePullPayment.pullPaymentExecutorAddress);
    });

    it('should execute the single pull payment', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        });
      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * singlePullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      String(treasuryBalanceAfter).should.be.equal(String(expectedAmountOfPmaTransferred));
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      singlePullPayment.currency = 'USD';
      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        }));
      singlePullPayment.currency = 'EUR';
    });

    it('should revert when the payment already exists', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        });

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        }));
    });

    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogPaymentRegistered');
      logs[ 1 ].args.customerAddress.should.be.equal(singlePullPayment.client);
      logs[ 1 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 1 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 1 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
    });

    it('should emit a "LogPullPaymentExecution" event', async () => {
      const signature = await signRegistrationV2_2(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID, singlePullPayment.paymentType ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        [ singlePullPayment.initialConversionRate, singlePullPayment.fiatAmountInCents, singlePullPayment.initialPaymentAmountInCents ],
        [ singlePullPayment.frequency, singlePullPayment.numberOfPayments, singlePullPayment.startTimestamp, singlePullPayment.trialPeriod ],
        singlePullPayment.currency,
        {
          from: executorOne
        });

      const logs = pumaPayPullPaymentRegistration.logs;
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * singlePullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(singlePullPayment.client);
      logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(singlePullPayment.initialConversionRate)));
      String(logs[ 0 ].args.amountInPMA).should.be.equal(( String(expectedAmountOfPmaTransferred) ));
    });
  });

  describe('Register Recurring Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });

    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(recurringPullPayment.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(recurringPullPayment.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.numberOfPayments - 1)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp + recurringPullPayment.frequency)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // last payment timestamp
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(recurringPullPayment.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(recurringPullPayment.pullPaymentExecutorAddress);
    });

    it('should execute the first payment from the recurring pull payment', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      String(treasuryBalanceAfter).should.be.equal(String(expectedAmountOfPmaTransferred));
    });

    it('should execute payments from the recurring pull payment: first payment and next one', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      // NOTE: this should actually be `recurringPullPayment.frequency + 1`
      // Even though when we run `node_modules/.bin/truffle test test/PumaPayPullPaymentV2.test.js` all the tests are passing with no issues
      // When running `npm test` it fails on this point. Therefore, I am time travelling `recurringPullPayment.frequency + DAY`
      await timeTravel(recurringPullPayment.frequency + DAY);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE, recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorTwo
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred = 2 * DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER;

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));
    });

    it('should execute payments from the recurring pull payment: first payment, next one with third execution failing', async () => {
      recurringPullPayment.numberOfPayments = 2;
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE, recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorOne
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred = 2 * DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER;
      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      await timeTravel(recurringPullPayment.frequency + 1);

      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE, recurringPullPayment.numberOfPayments - 1 ],
        {
          from: paymentExecutorThree
        }
      ));
      recurringPullPayment.numberOfPayments = 10;
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      recurringPullPayment.currency = 'EUR';
      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        }));
      recurringPullPayment.currency = 'USD';
    });

    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogPaymentRegistered');
      logs[ 1 ].args.customerAddress.should.be.equal(recurringPullPayment.client);
      logs[ 1 ].args.paymentID.should.be.equal(recurringPullPayment.paymentID);
      logs[ 1 ].args.businessID.should.be.equal(recurringPullPayment.businessID);
      logs[ 1 ].args.uniqueReferenceID.should.be.equal(recurringPullPayment.uniqueReferenceID);
    });

    it('should emit a "LogPullPaymentExecution" event', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringPullPayment.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringPullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringPullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringPullPayment.uniqueReferenceID);
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(recurringPullPayment.initialConversionRate)));
      String(logs[ 0 ].args.amountInPMA).should.be.equal(( String(expectedAmountOfPmaTransferred) ));
    });
  });

  describe('Register Recurring Pull Payment with Initial Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientThree
      });
    });

    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID,
          recurringWithInitialAmount.businessID,
          recurringWithInitialAmount.uniqueReferenceID,
          recurringWithInitialAmount.paymentType ],
        [
          recurringWithInitialAmount.client,
          recurringWithInitialAmount.pullPaymentExecutorAddress,
          recurringWithInitialAmount.treasuryAddress
        ],
        [
          recurringWithInitialAmount.initialConversionRate,
          recurringWithInitialAmount.fiatAmountInCents,
          recurringWithInitialAmount.initialPaymentAmountInCents
        ],
        [
          recurringWithInitialAmount.frequency,
          recurringWithInitialAmount.numberOfPayments,
          recurringWithInitialAmount.startTimestamp,
          recurringWithInitialAmount.trialPeriod
        ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringWithInitialAmount.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(recurringWithInitialAmount.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(recurringWithInitialAmount.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.numberOfPayments)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringWithInitialAmount.startTimestamp + recurringWithInitialAmount.frequency)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // last payment timestamp
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(recurringWithInitialAmount.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(recurringWithInitialAmount.pullPaymentExecutorAddress);
    });

    it('should execute the first payment from the recurring pull payment', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * recurringWithInitialAmount.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      String(treasuryBalanceAfter).should.be.equal(String(expectedAmountOfPmaTransferred));
    });

    it('should execute payments from the recurring pull payment: first payment and next one', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithInitialAmount.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringWithInitialAmount.client,
        recurringWithInitialAmount.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithInitialAmount.numberOfPayments ],
        {
          from: paymentExecutorTwo
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithInitialAmount.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithInitialAmount.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));
    });

    it('should execute payments from the recurring pull payment: initial payment, next two payments with third execution failing', async () => {
      recurringWithInitialAmount.numberOfPayments = 2;
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithInitialAmount.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringWithInitialAmount.client,
        recurringWithInitialAmount.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithInitialAmount.numberOfPayments ],
        {
          from: paymentExecutorThree
        }
      );

      await timeTravel(recurringWithInitialAmount.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringWithInitialAmount.client,
        recurringWithInitialAmount.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithInitialAmount.numberOfPayments - 1 ],
        {
          from: executorTwo
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);

      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithInitialAmount.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithInitialAmount.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithInitialAmount.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      await timeTravel(recurringWithInitialAmount.frequency + 1);

      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringWithInitialAmount.client,
        recurringWithInitialAmount.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithInitialAmount.numberOfPayments - 2 ],
        {
          from: executorOne
        }
      ));
      recurringWithInitialAmount.numberOfPayments = 10;
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      recurringWithInitialAmount.currency = 'EUR';
      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        }));
      recurringWithInitialAmount.currency = 'USD';
    });

    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogPaymentRegistered');
      logs[ 1 ].args.customerAddress.should.be.equal(recurringWithInitialAmount.client);
      logs[ 1 ].args.paymentID.should.be.equal(recurringWithInitialAmount.paymentID);
      logs[ 1 ].args.businessID.should.be.equal(recurringWithInitialAmount.businessID);
      logs[ 1 ].args.uniqueReferenceID.should.be.equal(recurringWithInitialAmount.uniqueReferenceID);
    });

    it('should emit a "LogPullPaymentExecution" event', async () => {
      const signature = await signRegistrationV2_2(recurringWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithInitialAmount.paymentID, recurringWithInitialAmount.businessID, recurringWithInitialAmount.uniqueReferenceID, recurringWithInitialAmount.paymentType ],
        [ recurringWithInitialAmount.client, recurringWithInitialAmount.pullPaymentExecutorAddress, recurringWithInitialAmount.treasuryAddress ],
        [ recurringWithInitialAmount.initialConversionRate, recurringWithInitialAmount.fiatAmountInCents, recurringWithInitialAmount.initialPaymentAmountInCents ],
        [ recurringWithInitialAmount.frequency, recurringWithInitialAmount.numberOfPayments, recurringWithInitialAmount.startTimestamp, recurringWithInitialAmount.trialPeriod ],
        recurringWithInitialAmount.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;
      const expectedAmountOfPmaTransferred =
        DECIMAL_FIXER * recurringWithInitialAmount.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringWithInitialAmount.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringWithInitialAmount.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringWithInitialAmount.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringWithInitialAmount.uniqueReferenceID);
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(recurringWithInitialAmount.initialConversionRate)));
      String(logs[ 0 ].args.amountInPMA).should.be.equal(String(web3.utils.toWei(( String(expectedAmountOfPmaTransferred) ))));
    });
  });

  describe('Register Recurring Pull Payment with Free Trial', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientThree
      });
    });

    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID,
          recurringWithFreeTrial.businessID,
          recurringWithFreeTrial.uniqueReferenceID,
          recurringWithFreeTrial.paymentType ],
        [
          recurringWithFreeTrial.client,
          recurringWithFreeTrial.pullPaymentExecutorAddress,
          recurringWithFreeTrial.treasuryAddress
        ],
        [
          recurringWithFreeTrial.initialConversionRate,
          recurringWithFreeTrial.fiatAmountInCents,
          recurringWithFreeTrial.initialPaymentAmountInCents
        ],
        [
          recurringWithFreeTrial.frequency,
          recurringWithFreeTrial.numberOfPayments,
          recurringWithFreeTrial.startTimestamp,
          recurringWithFreeTrial.trialPeriod
        ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        });

      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringWithFreeTrial.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(recurringWithFreeTrial.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(recurringWithFreeTrial.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.numberOfPayments)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(recurringWithFreeTrial.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringWithFreeTrial.startTimestamp + recurringWithFreeTrial.trialPeriod)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(0)); // last payment timestamp
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(recurringWithFreeTrial.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(recurringWithFreeTrial.pullPaymentExecutorAddress);
    });

    it('should execute payments from the recurring pull payment after the free trial has passed', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithFreeTrial.trialPeriod + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringWithFreeTrial.client,
        recurringWithFreeTrial.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithFreeTrial.numberOfPayments ],
        {
          from: paymentExecutorOne
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithFreeTrial.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));
    });

    it('should execute payments from the recurring pull payment after free trial: two payments with third execution failing', async () => {
      recurringWithFreeTrial.numberOfPayments = 2;
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithFreeTrial.trialPeriod + 1);
      for (let i = 0; i < recurringWithFreeTrial.numberOfPayments; i++) {
        await pumaPayPullPayment.executePullPayment(
          recurringWithFreeTrial.client,
          recurringWithFreeTrial.paymentID,
          [ USD_EXCHANGE_RATE,
            recurringWithFreeTrial.numberOfPayments - i ],
          {
            from: executorOne
          }
        );

        await timeTravel(recurringWithFreeTrial.frequency + 1);
      }

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);

      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithFreeTrial.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithFreeTrial.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringWithFreeTrial.client,
        recurringWithFreeTrial.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithFreeTrial.numberOfPayments - recurringWithFreeTrial.numberOfPayments ],
        {
          from: executorTwo
        }
      ));
      recurringWithFreeTrial.numberOfPayments = 10;
    });

    it('should revert if the free trial has not passed', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithFreeTrial.trialPeriod - 1);
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringWithFreeTrial.client,
        recurringWithFreeTrial.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithFreeTrial.numberOfPayments ],
        {
          from: paymentExecutorOne
        }
      ));
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      recurringWithFreeTrial.currency = 'EUR';
      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        }));
      recurringWithFreeTrial.currency = 'USD';
    });

    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await signRegistrationV2_2(recurringWithFreeTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithFreeTrial.paymentID, recurringWithFreeTrial.businessID, recurringWithFreeTrial.uniqueReferenceID, recurringWithFreeTrial.paymentType ],
        [ recurringWithFreeTrial.client, recurringWithFreeTrial.pullPaymentExecutorAddress, recurringWithFreeTrial.treasuryAddress ],
        [ recurringWithFreeTrial.initialConversionRate, recurringWithFreeTrial.fiatAmountInCents, recurringWithFreeTrial.initialPaymentAmountInCents ],
        [ recurringWithFreeTrial.frequency, recurringWithFreeTrial.numberOfPayments, recurringWithFreeTrial.startTimestamp, recurringWithFreeTrial.trialPeriod ],
        recurringWithFreeTrial.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentRegistered');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringWithFreeTrial.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringWithFreeTrial.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringWithFreeTrial.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringWithFreeTrial.uniqueReferenceID);
    });
  });

  describe('Register Recurring Pull Payment with Paid Trial', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientThree
      });
    });

    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID,
          recurringWithPaidTrial.businessID,
          recurringWithPaidTrial.uniqueReferenceID,
          recurringWithPaidTrial.paymentType ],
        [
          recurringWithPaidTrial.client,
          recurringWithPaidTrial.pullPaymentExecutorAddress,
          recurringWithPaidTrial.treasuryAddress
        ],
        [
          recurringWithPaidTrial.initialConversionRate,
          recurringWithPaidTrial.fiatAmountInCents,
          recurringWithPaidTrial.initialPaymentAmountInCents
        ],
        [
          recurringWithPaidTrial.frequency,
          recurringWithPaidTrial.numberOfPayments,
          recurringWithPaidTrial.startTimestamp,
          recurringWithPaidTrial.trialPeriod
        ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringWithPaidTrial.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(recurringWithPaidTrial.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(recurringWithPaidTrial.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.numberOfPayments)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringWithPaidTrial.startTimestamp + recurringWithPaidTrial.trialPeriod)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // last payment timestamp
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(recurringWithPaidTrial.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(recurringWithPaidTrial.pullPaymentExecutorAddress);
    });

    it('should execute the initial payment for the paid trial', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);
      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithPaidTrial.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));
    });

    it('should execute payments from the recurring pull payment with paid trial: intial payment, two recurring payments with third execution failing', async () => {
      recurringWithPaidTrial.numberOfPayments = 2;
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithPaidTrial.trialPeriod + 1);
      for (let i = 0; i < recurringWithPaidTrial.numberOfPayments; i++) {
        await pumaPayPullPayment.executePullPayment(
          recurringWithPaidTrial.client,
          recurringWithPaidTrial.paymentID,
          [ EUR_EXCHANGE_RATE,
            recurringWithPaidTrial.numberOfPayments - i ],
          {
            from: paymentExecutorThree
          }
        );

        await timeTravel(recurringWithPaidTrial.frequency + 1);
      }

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);

      const expectedAmountOfPmaTransferred =
        ( DECIMAL_FIXER * recurringWithPaidTrial.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithPaidTrial.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER ) +
        ( DECIMAL_FIXER * recurringWithPaidTrial.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringWithPaidTrial.client,
        recurringWithPaidTrial.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithPaidTrial.numberOfPayments - recurringWithPaidTrial.numberOfPayments ],
        {
          from: paymentExecutorTwo
        }
      ));
      recurringWithPaidTrial.numberOfPayments = 10;
    });

    it('pull payment execution for recurring payment should revert if the paid trial has not passed', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      await timeTravel(recurringWithPaidTrial.trialPeriod - 1);
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringWithPaidTrial.client,
        recurringWithPaidTrial.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringWithPaidTrial.numberOfPayments ],
        {
          from: owner
        }
      ));
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      recurringWithPaidTrial.fiatAmountInCents = 50;
      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        }));
      recurringWithPaidTrial.fiatAmountInCents = 200;
    });

    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 1 ].event, 'LogPaymentRegistered');
      logs[ 1 ].args.customerAddress.should.be.equal(recurringWithPaidTrial.client);
      logs[ 1 ].args.paymentID.should.be.equal(recurringWithPaidTrial.paymentID);
      logs[ 1 ].args.businessID.should.be.equal(recurringWithPaidTrial.businessID);
      logs[ 1 ].args.uniqueReferenceID.should.be.equal(recurringWithPaidTrial.uniqueReferenceID);
    });

    it('should emit a "LogPullPaymentExecution" event', async () => {
      const signature = await signRegistrationV2_2(recurringWithPaidTrial, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringWithPaidTrial.paymentID, recurringWithPaidTrial.businessID, recurringWithPaidTrial.uniqueReferenceID, recurringWithPaidTrial.paymentType ],
        [ recurringWithPaidTrial.client, recurringWithPaidTrial.pullPaymentExecutorAddress, recurringWithPaidTrial.treasuryAddress ],
        [ recurringWithPaidTrial.initialConversionRate, recurringWithPaidTrial.fiatAmountInCents, recurringWithPaidTrial.initialPaymentAmountInCents ],
        [ recurringWithPaidTrial.frequency, recurringWithPaidTrial.numberOfPayments, recurringWithPaidTrial.startTimestamp, recurringWithPaidTrial.trialPeriod ],
        recurringWithPaidTrial.currency,
        {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentRegistration.logs;
      const expectedAmountOfPmaTransferred =
        DECIMAL_FIXER * recurringWithPaidTrial.initialPaymentAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER;

      assert.equal(logs.length, 2);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringWithPaidTrial.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringWithPaidTrial.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringWithPaidTrial.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringWithPaidTrial.uniqueReferenceID);
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(recurringWithPaidTrial.initialConversionRate)));
      String(logs[ 0 ].args.amountInPMA).should.be.equal(String(web3.utils.toWei(( String(expectedAmountOfPmaTransferred) ))));
    });
  });

  describe('Cancel Recurring Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });
    beforeEach('register to a pull payment recurring pull payment', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency, {
          from: executorOne
        });
    });

    it('should set the cancel date of the pull payment for the paymentExecutorOne to NOW', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });
      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // CANCEL PAYMENT TIMESTAMP
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: owner
        }));
    });

    it('should revert when the payment for the beneficiary does not exists', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        }));
    });

    it('should revert when the deletion pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID, // some other payment ID
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        }));
    });

    it('should emit a "LogPaymentCancelled" event', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentDeletion = await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });

      const logs = pumaPayPullPaymentDeletion.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentCancelled');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringPullPayment.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringPullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringPullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringPullPayment.uniqueReferenceID);
    });
  });

  describe('Execute pull payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });
    beforeEach('register to a pull payment recurring pull payment', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency, {
          from: executorOne
        });
    });

    it('should execute successfully a recurring pull payment', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: deployerAccount
        }
      );

      const treasuryBalanceAfter = await token.balanceOf(recurringPullPayment.treasuryAddress);
      // amount transferred on registration + amount transferred on execution
      const expectedAmountOfPmaTransferred =
        DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER +
        DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER;

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));
    });

    it('should update the pull payment with next payment timestamp', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: owner
        }
      );

      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      // Two executions has happened - one on registration and another one on the execution
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp + ( 2 * recurringPullPayment.frequency ))));
    });

    it('should update the pull payment with last payment timestamp', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorTwo
        }
      );

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // last payment timestamp
    });

    it('should update the pull payment with number of payments', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorOne
        }
      );

      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      // Two executions has happened - one on registration and another one on the execution
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.numberOfPayments - 2)));
    });

    it('should allow for pull payment executions to happen even though some executions were missed', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: paymentExecutorOne
        }
      );

      // 4 more executions have passed without being executed
      await timeTravel(4 * recurringPullPayment.frequency + 1);

      for (let i = 0; i < 4; i++) {
        await pumaPayPullPayment.executePullPayment(
          recurringPullPayment.client,
          recurringPullPayment.paymentID,
          [ EUR_EXCHANGE_RATE,
            recurringPullPayment.numberOfPayments - ( i + 2 ) ],
          {
            from: paymentExecutorThree
          }
        );
      }

      const treasuryBalanceAfter = await token.balanceOf(recurringPullPayment.treasuryAddress);
      const expectedAmountOfPmaTransferred =
        DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER +
        5 * ( DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      // next one should fail
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - recurringPullPayment.numberOfPayments ],
        {
          from: owner
        }
      ));
    });

    it('should allow for pull payment executions to happen even though some executions were missed and the customer has cancelled the subscription', async () => {
      await timeTravel(recurringPullPayment.frequency + 1);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: recurringPullPayment.client
        }
      );

      // 4 more executions have passed without being executed
      await timeTravel(4 * recurringPullPayment.frequency + 1);

      // customer cancel the pull payment
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });

      for (let i = 0; i < 4; i++) {
        await pumaPayPullPayment.executePullPayment(
          recurringPullPayment.client,
          recurringPullPayment.paymentID,
          [ EUR_EXCHANGE_RATE,
            recurringPullPayment.numberOfPayments - ( i + 2 ) ],
          {
            from: treasuryAddress
          }
        );
      }

      const treasuryBalanceAfter = await token.balanceOf(recurringPullPayment.treasuryAddress);
      const expectedAmountOfPmaTransferred =
        DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / USD_EXCHANGE_RATE / FIAT_TO_CENT_FIXER +
        5 * ( DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER );

      String(treasuryBalanceAfter).should.be.equal(String(web3.utils.toWei(String(expectedAmountOfPmaTransferred))));

      // next one should fail
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 6 ],
        {
          from: recurringPullPayment.treasuryAddress
        }
      ));
    });

    it('should fail when next payment timestamp has not passed', async () => {
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: recurringPullPayment.client
        }
      ));
    });

    it('should fail when pull payment was cancelled', async () => {
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });

      await timeTravel(recurringPullPayment.frequency + 1);
      await assertRevert(pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ USD_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorTwo
        }
      ));
    });

    it('should emit a "LogPullPaymentExecution" event', async () => {
      const pullPaymentExecution = await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ EUR_EXCHANGE_RATE,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: treasuryAddress
        }
      );
      const logs = pullPaymentExecution.logs;
      const expectedAmountOfPmaTransferred =
        web3.utils.toWei(String(DECIMAL_FIXER * recurringPullPayment.fiatAmountInCents / EUR_EXCHANGE_RATE / FIAT_TO_CENT_FIXER));

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.customerAddress.should.be.equal(recurringPullPayment.client);
      logs[ 0 ].args.paymentID.should.be.equal(recurringPullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(recurringPullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(recurringPullPayment.uniqueReferenceID);
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(EUR_EXCHANGE_RATE)));
      String(logs[ 0 ].args.amountInPMA).should.be.equal(( String(expectedAmountOfPmaTransferred) ));
    });
  });

  describe('Add Executor - Funding', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(2, deployerAccount, pumaPayPullPayment.address);
    });
    afterEach('Transfer ETH to owner account', async () => {
      await web3.eth.sendTransaction({
        from: deployerAccount,
        to: owner,
        value: 5 * ONE_ETHER
      });
    });

    it('should transfer ETH to the owner when its balance is lower than 0.15 ETH', async () => {
      const ownerBalance = await web3.eth.getBalance(owner);
      const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');

      await web3.eth.sendTransaction({
        from: owner,
        to: deployerAccount,
        value: web3.utils.toWei(String(ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
      });
      const ownerBalanceBefore = await web3.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const ownerBalanceAfter = await web3.eth.getBalance(owner);

      const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
      assert.equal(executor, true);
    });
  });

  describe('Remove Executor - Funding', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(2, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    afterEach('Transfer ETH to owner account', async () => {
      web3.eth.sendTransaction({
        from: deployerAccount,
        to: owner,
        value: 5 * ONE_ETHER
      }, () => {
      });
    });

    it('should transfer ETH to the owner when its balance is lower than 0.15 ETH', async () => {
      const ownerBalance = await web3.eth.getBalance(owner);
      const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');

      await web3.eth.sendTransaction({
        from: owner,
        to: deployerAccount,
        value: web3.utils.toWei(String(ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
      });

      const ownerBalanceBefore = await web3.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.removeExecutor(executorOne, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;

      const ownerBalanceAfter = await web3.eth.getBalance(owner);

      const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
      assert.equal(executor, false);
    });
  });

  describe('Register Pull Payment - Funding', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(3, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from first client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });
    afterEach('Transfer ETH to executor account', async () => {
      await web3.eth.sendTransaction({
        from: deployerAccount,
        to: executorOne,
        value: 5 * ONE_ETHER
      });
    });
    it('should transfer ETH to the executor when its balance is lower than 0.15 ETH and register a pull payment', async () => {
      const executorBalance = await web3.eth.getBalance(executorOne);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await web3.eth.sendTransaction({
        from: executorOne,
        to: deployerAccount,
        value: web3.utils.toWei(String(executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
      });

      const executorBalanceBefore = await web3.eth.getBalance(executorOne);
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const transaction = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorOne
        });

      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const executorBalanceAfter = await web3.eth.getBalance(executorOne);
      const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));

      assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      activePaymentInArray[ 0 ].should.be.equal(recurringPullPayment.paymentType);
      activePaymentInArray[ 1 ].should.be.equal(recurringPullPayment.currency);
      String(activePaymentInArray[ 2 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.initialConversionRate)));
      String(activePaymentInArray[ 3 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.initialPaymentAmountInCents)));
      String(activePaymentInArray[ 4 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.fiatAmountInCents)));
      String(activePaymentInArray[ 5 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.frequency)));
      String(activePaymentInArray[ 6 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.numberOfPayments - 1)));
      String(activePaymentInArray[ 7 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp)));
      String(activePaymentInArray[ 8 ]).should.be.equal(String(web3.utils.toBN(recurringPullPayment.trialPeriod)));
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp + recurringPullPayment.frequency)));
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate)));
      String(activePaymentInArray[ 11 ]).should.be.equal(String(0)); // cancel payment timestamp
      String(activePaymentInArray[ 12 ]).should.be.equal(recurringPullPayment.treasuryAddress);
      String(activePaymentInArray[ 13 ]).should.be.equal(recurringPullPayment.pullPaymentExecutorAddress);
    });
  });

  describe('Delete Pull Payment - Funding', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(3, deployerAccount, pumaPayPullPayment.address);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from first client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });
    beforeEach('Add single pull payment', async () => {
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorOne
        });
    });
    afterEach('Transfer ETH to executor account', async () => {
      await web3.eth.sendTransaction({
        from: deployerAccount,
        to: executorOne,
        value: 5 * ONE_ETHER
      });
    });
    it('should transfer ETH to the executor when its balance is lower than 0.01 ETH', async () => {
      const executorBalance = await web3.eth.getBalance(executorOne);
      const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
      await web3.eth.sendTransaction({
        from: executorOne,
        to: deployerAccount,
        value: web3.utils.toWei(String(executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
      });

      const executorBalanceBefore = await web3.eth.getBalance(executorOne);
      const signature = await signDeletionV2_2(recurringPullPayment.paymentID, recurringPullPayment.pullPaymentExecutorAddress, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const transaction = await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        recurringPullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });

      const txFee = Number(transaction.receipt.gasUsed) * GAS_PRICE;
      const executorBalanceAfter = await web3.eth.getBalance(executorOne);
      const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));

      assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));

      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(recurringPullPayment.paymentID);

      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // CANCEL PAYMENT TS
    });
  });

  describe('Overflow checks for pull payment execution', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferETH(1, deployerAccount, pumaPayPullPayment.address);
    });

    beforeEach('add an executor', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });

    beforeEach('Approve pull payment smart contract with 90 Billion Billions of PMA', async () => {
      await token.approve(pumaPayPullPayment.address, web3.utils.toWei(( MINTED_TOKENS + '000000000000000000' )), {
        from: clientTwo
      });
    });
    beforeEach('Issue tokens to client', async () => {
      const tokens = MINTED_TOKENS + '0000000';
      await token.mint(clientTwo, tokens, {
        from: deployerAccount
      });
    });

    it('should execute a pull payment of 1 BILLION FIAT with a conversion rate of 1 PMA = 100k EUR', async () => {
      recurringPullPayment.fiatAmountInCents = 100000000000; // 1 billion in FIAT cents
      recurringPullPayment.initialConversionRate = DECIMAL_FIXER + '00000'; // 1 PMA = 100k EUR // 10^15
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorOne
        });

      const rate = DECIMAL_FIXER + '00000'; // 1 PMA = 100k EUR // 10^15

      await timeTravel(recurringPullPayment.frequency);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ rate,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorTwo
        });

      const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
      // 1 PMA = 100k EUR ==> 1 Billion EUR = 10000 PMA
      // On execution we have two payments that have happened already.
      // One on registration and another one on execution.
      // Therefore, the actual PMA amount is 20000
      Number(balanceOfTreasuryAfter.toString()).should.be.equal(20000 * ONE_ETHER);
    });

    it('should execute a pull payment of 100k FIAT with a conversion rate of 1 PMA = 0.000001 FIAT', async () => {
      recurringPullPayment.fiatAmountInCents = 10000000; // 100k FIAT in cents
      recurringPullPayment.initialConversionRate = '100000'; // 1 PMA = 0.00001 FIAT // 0.00001 * DECIMAL_FIXER
      const signature = await signRegistrationV2_2(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID, recurringPullPayment.paymentType ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        [ recurringPullPayment.initialConversionRate, recurringPullPayment.fiatAmountInCents, recurringPullPayment.initialPaymentAmountInCents ],
        [ recurringPullPayment.frequency, recurringPullPayment.numberOfPayments, recurringPullPayment.startTimestamp, recurringPullPayment.trialPeriod ],
        recurringPullPayment.currency,
        {
          from: executorOne
        });

      const rate = '100000'; // 1 PMA = 0.00001 FIAT // 0.00001 * DECIMAL_FIXER

      await timeTravel(recurringPullPayment.frequency);
      await pumaPayPullPayment.executePullPayment(
        recurringPullPayment.client,
        recurringPullPayment.paymentID,
        [ rate,
          recurringPullPayment.numberOfPayments - 1 ],
        {
          from: executorOne
        });

      const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.00001 EUR ==> 1 EUR = 100000 PMA ==> 100k EUR = 10000000000 PMA
      Number(balanceOfTreasuryAfter.toString()).should.be.equal(20000000000 * ONE_ETHER);
    });
  });
});
