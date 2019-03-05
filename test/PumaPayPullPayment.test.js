const {assertRevert} = require('./helpers/assertRevert');

const {timeTravel, currentBlockTime} = require('./helpers/timeHelper');
const {
  calcSignedMessageForRegistration,
  calcSignedMessageForDeletion,
  getVRS
} = require('./helpers/signatureCalculator');
const PumaPayToken = artifacts.require('PumaPayToken');

const PumaPayPullPayment = artifacts.require('PumaPayPullPayment');
const BigNumber = web3.BigNumber;
const Web3 = require('web3');
const web3API = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));

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
const MINTED_TOKENS = web3.utils.toWei('1000000000', 'ether'); // 1 Billion PMA
const EUR_EXCHANGE_RATE = 100000000; // 0.01 * 1^10
const USD_EXCHANGE_RATE = 200000000; // 0.02 * 1^10

const CLIENT_ONE_PRIVATE_KEY = '0xbebca8c785dff420b4a0b0c4c61e262b380f34e6ee4789044050ef8bca4bf821';
const CLIENT_TWO_PRIVATE_KEY = '0x6618238d98d6cddf9764a73a046474cbc24373a16acc09b66ca911455b6d3111';
const CLIENT_THREE_PRIVATE_KEY = '0xe2e00d88c4f66daf29875c6b23702631db4cab46034041ceee39617f8fcf5e49';

contract('PumaPay Pull Payment Contract', async (accounts) => {
  const deployerAccount = accounts[ 0 ];    // 0xe689c075c808404C9A0d84bE10d2E960CC61c497
  const owner = accounts[ 1 ];              // 0x853C292e80e2ba1f93F33Af6046C3A0B2EaE47Dc
  const executorOne = accounts[ 2 ];        // 0xf52DBA6fe86D2f80c13F2e2565F521Ad0C18Efc0
  const executorTwo = accounts[ 3 ];        // 0x8CB728587175968B3616758FD0a528D057dFc336
  const facilitatorOne = accounts[ 4 ];     // 0x3D76b36e4F76D7220001F21Cf0C70F2fb5799e6b
  const facilitatorTwo = accounts[ 5 ];     // 0x5252055feEf476DBc6Ef32eF58Fd324b988F13B2
  const facilitatorThree = accounts[ 6 ];   // 0xAaeDDcD2c5c96dF8Fc4297333f66b4Ea61fc3ab3
  const clientOne = accounts[ 7 ];          // 0xb2F990cCC50Da372307b080501BfA4703c1C499B
  const clientTwo = accounts[ 8 ];          // 0x34bfe2E8cbec8d0263Cd24c67166022C2D350614
  const clientThree = accounts[ 9 ];        // 0xc4771Be5D994847bE5B846E7126A0F73c6A0B144
  const treasuryAddress = accounts[ 10 ];

  let singlePullPayment = {
    paymentID: web3API.utils.fromAscii('paymentID_1'),
    businessID: web3API.utils.fromAscii('businessID_1'),
    uniqueReferenceID: web3API.utils.fromAscii('uniqueReferenceID_1'),
    client: clientOne,
    pullPaymentExecutorAddress: facilitatorOne,
    currency: 'EUR',
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 100000000, // 1 million in EUR cents
    frequency: 1,
    numberOfPayments: 1,
    startTimestamp: Math.floor(Date.now() / 1000) + DAY,
    treasuryAddress: treasuryAddress
  };

  let recurringPullPayment = {
    paymentID: web3API.utils.fromAscii('paymentID_2'),
    businessID: web3API.utils.fromAscii('businessID_2'),
    uniqueReferenceID: web3API.utils.fromAscii('uniqueReferenceID_2'),
    client: clientTwo,
    pullPaymentExecutorAddress: facilitatorTwo,
    currency: 'USD',
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000) + DAY,
    treasuryAddress: treasuryAddress
  };

  let recurringPullPaymentWithInitialAmount = {
    paymentID: web3API.utils.fromAscii('paymentID_3'),
    businessID: web3API.utils.fromAscii('businessID_3'),
    uniqueReferenceID: web3API.utils.fromAscii('uniqueReferenceID_3'),
    client: clientThree,
    pullPaymentExecutorAddress: facilitatorThree,
    currency: 'USD',
    initialPaymentAmountInCents: 100,
    fiatAmountInCents: 200, // 2.00 USD in cents
    frequency: 2 * DAY,
    numberOfPayments: 10,
    startTimestamp: Math.floor(Date.now() / 1000) + 2 * DAY,
    treasuryAddress: treasuryAddress
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

  beforeEach('set the rate for multiple fiat currencies', async () => {
    await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
      from: owner
    });
    await pumaPayPullPayment.setRate('USD', USD_EXCHANGE_RATE, {
      from: owner
    });
  });

  const transferEthersToSmartContract = async (ethers, fromAccount, smartContract) => {
    await smartContract.sendTransaction(
      {
        from: fromAccount,
        value: ethers * ONE_ETHER
      }
    );
  };

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
        }));
    });
  });

  describe('Add executor', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });

    it('should set the executor specified to true', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(executor, true);
    });

    it('should transfer ETHER to the executor account for paying gas fees', async () => {
      const executorBalanceBefore = await web3API.eth.getBalance(executorOne);
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      const executorBalanceAfter = await web3API.eth.getBalance(executorOne);

      assert.equal(String(executorBalanceAfter - executorBalanceBefore), String(ONE_ETHER));
    });

    it('should revert when the executor is a ZERO address', async () => {
      await assertRevert(
        pumaPayPullPayment.addExecutor(ZERO_ADDRESS, {
          from: owner
        })
      );
    });

    it('should revert when the adding the same executor', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      await assertRevert(
        pumaPayPullPayment.addExecutor(executorOne, {
          from: owner
        })
      );
    });

    it('should revert if NOT executed by the owner', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });

      await assertRevert(
        pumaPayPullPayment.addExecutor(executorTwo, {
          from: executorOne
        })
      );
    });
  });

  describe('Remove executor', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });

    beforeEach('add an executor', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });

    it('should set the executor specified to false', async () => {
      await pumaPayPullPayment.removeExecutor(executorOne, {
        from: owner
      });
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(executor, false);
    });

    it('should revert when the executor is a ZERO address', async () => {
      await assertRevert(
        pumaPayPullPayment.removeExecutor(ZERO_ADDRESS, {
          from: owner
        })
      );
    });

    it('should revert when the executor does not exists', async () => {
      await assertRevert(
        pumaPayPullPayment.removeExecutor(executorTwo, {
          from: owner
        })
      );
    });

    it('should revert if NOT executed by the owner', async () => {
      await assertRevert(
        pumaPayPullPayment.removeExecutor(executorTwo, {
          from: executorOne
        })
      );
    });
  });

  describe('Set Rate', async () => {
    it('should set the rate for fiat currency', async () => {
      await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE * 10, {
        from: owner
      });
      const euroRate = await pumaPayPullPayment.getRate('EUR');
      String(euroRate).should.be.equal(String(web3API.utils.toBN(EUR_EXCHANGE_RATE * 10)));
    });

    it('should set the rate for multiple fiat currencies', async () => {
      const euroRate = await pumaPayPullPayment.getRate('EUR');
      const usdRate = await pumaPayPullPayment.getRate('USD');

      String(euroRate).should.be.equal(String(web3API.utils.toBN(EUR_EXCHANGE_RATE)));
      String(usdRate).should.be.equal(String(web3API.utils.toBN(USD_EXCHANGE_RATE)));
    });

    it('should revert when not executed by the owner', async () => {
      await assertRevert(pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
        from: deployerAccount
      }));
    });

    it('should allow everyone to retrieve the rate', async () => {
      const usdRate = await pumaPayPullPayment.getRate('USD', {
        from: deployerAccount
      });

      String(usdRate).should.be.equal(String(web3API.utils.toBN(USD_EXCHANGE_RATE)));
    });

    it('should emit a "LogSetConversionRate" event', async () => {
      const setRate = await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
        from: owner
      });
      const logs = setRate.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogSetConversionRate');
      logs[ 0 ].args.currency.should.be.equal('EUR');
      String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3API.utils.toBN(EUR_EXCHANGE_RATE)));
    });
  });

  describe('Register Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    it('should add the pull payment for the beneficiary in the active payments array', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorOne
        });

      const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      activePaymentInArray[ 0 ].should.be.equal(singlePullPayment.paymentID); // PAYMENT ID
      activePaymentInArray[ 1 ].should.be.equal(singlePullPayment.businessID); // BUSINESS ID
      activePaymentInArray[ 2 ].should.be.equal(singlePullPayment.uniqueReferenceID); // UNIQUE REFERENCE ID
      activePaymentInArray[ 3 ].should.be.equal(singlePullPayment.currency); // CURRENCY
      String(activePaymentInArray[ 4 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.initialPaymentAmountInCents))); // INITIAL AMOUNT
      String(activePaymentInArray[ 5 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.fiatAmountInCents))); // FIAT AMOUNT
      String(activePaymentInArray[ 6 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.frequency))); // FREQUENCY
      String(activePaymentInArray[ 7 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.numberOfPayments))); // NUMBER OF ALLOWED PULL PAYMENTS
      String(activePaymentInArray[ 8 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.startTimestamp))); // START TIMESTAMP
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.startTimestamp))); // NEXT PAYMENT TIMESTAMP = START TIMESTAMP
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3API.utils.toBN(0))); // LAST PAYMENT TIMESTAMP
      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3API.utils.toBN(0))); // CANCEL PAYMENT TIMESTAMP
      activePaymentInArray[ 12 ].should.be.equal(treasuryAddress); // TREASURY ADDRESS
    });

    it('should revert when NOT executed an executor', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: deployerAccount
        }));
    });

    it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        recurringPullPayment.currency,
        recurringPullPayment.initialPaymentAmountInCents,
        recurringPullPayment.fiatAmountInCents,
        recurringPullPayment.frequency,
        recurringPullPayment.numberOfPayments,
        recurringPullPayment.startTimestamp,
        {
          from: executorOne
        }));
    });


    it('should emit a "LogPaymentRegistered" event', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorOne
        });

      const logs = pumaPayPullPaymentRegistration.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentRegistered');
      logs[ 0 ].args.clientAddress.should.be.equal(singlePullPayment.client);
      logs[ 0 ].args.pullPaymentExecutorAddress.should.be.equal(singlePullPayment.pullPaymentExecutorAddress);
      logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
    });
  });

  describe('Delete Recurring Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });
    beforeEach('Add single pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorOne
        });
    });

    beforeEach('Add recurring pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        recurringPullPayment.currency,
        recurringPullPayment.initialPaymentAmountInCents,
        recurringPullPayment.fiatAmountInCents,
        recurringPullPayment.frequency,
        recurringPullPayment.numberOfPayments,
        recurringPullPayment.startTimestamp,
        {
          from: executorTwo
        });
    });

    it('should set the cancel date of the pull payment for the facilitatorOne to NOW', async () => {
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, singlePullPayment.pullPaymentExecutorAddress, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        singlePullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });
      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3API.utils.toBN(ethDate))); // CANCEL PAYMENT TIMESTAMP
    });

    it('should revert when NOT executed by an executor', async () => {
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, facilitatorOne, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        facilitatorOne, {
          from: owner
        }));
    });

    it('should revert when the payment for the beneficiary does not exists', async () => {
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, facilitatorOne, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        facilitatorThree, {
          from: executorOne
        }));
    });

    it('should revert when the deletion pull payment params does match with the ones signed by the signatory', async () => {
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, facilitatorOne, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        facilitatorTwo, {
          from: executorOne
        }));
    });

    it('should emit a "LogPaymentCancelled" event', async () => {
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, facilitatorOne, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pumaPayPullPaymentDeletion = await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        facilitatorOne, {
          from: executorTwo
        });

      const logs = pumaPayPullPaymentDeletion.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentCancelled');
      logs[ 0 ].args.clientAddress.should.be.equal(singlePullPayment.client);
      logs[ 0 ].args.pullPaymentExecutorAddress.should.be.equal(singlePullPayment.pullPaymentExecutorAddress);
      logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
    });
  });

  describe('Execute Single Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorTwo, {
        from: owner
      });
    });

    beforeEach('approve PumaPay Pull Payment  to transfer from first client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
    });

    beforeEach('set simple pull payment details', async () => {
      const ethDate = await currentBlockTime();
      singlePullPayment.startTimestamp = ethDate + DAY;
    });

    beforeEach('Add single pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorTwo
        });
    });

    it('should pull the amount specified on the payment details to the facilitatorOne', async () => {
      await timeTravel(DAY + 1);
      await pumaPayPullPayment.executePullPayment(singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.paymentID, {
        from: facilitatorOne
      });

      const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.01 EUR ==> 1 EUR = 100 PMA ==> 1000000 EUR = 100000000 PMA
      Number(balanceOfTreasuryAfter).should.be.equal(100000000 * ONE_ETHER);
    });

    it('should update the pull payment numberOfPayments', async () => {
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      });

      const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      String(pullPayment[ 7 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.numberOfPayments - 1))); // NUMBER OF PAYMENTS
    });

    it('should update the pull payment nextPaymentTimestamp', async () => {
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      });

      const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);
      String(pullPayment[ 9 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.startTimestamp + singlePullPayment.frequency))); // NEXT PAYMENT TIMESTAMP
    });

    it('should update the pull payment lastPaymentTimestamp', async () => {
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      });
      const ethDate = await currentBlockTime();
      const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      String(pullPayment[ 10 ]).should.be.equal(String(web3API.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
    });

    it('should revert if executed before the start date specified in the payment', async () => {
      await timeTravel(DAY - 10);
      await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      }));
    });

    it('should revert when executed twice, i.e. number of payments is zero', async () => {
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      });

      await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      }));
    });

    it('should revert when pull payment does not exists for beneficiary calling the smart contract', async () => {
      await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorThree
      }));
    });

    it('should emit a "LogPullPaymentExecuted" event', async () => {
      await timeTravel(DAY);
      const pullPaymentExecution = await pumaPayPullPayment.executePullPayment(clientOne, facilitatorOne, singlePullPayment.paymentID, {
        from: facilitatorOne
      });

      const logs = pullPaymentExecution.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
      logs[ 0 ].args.clientAddress.should.be.equal(singlePullPayment.client);
      logs[ 0 ].args.pullPaymentExecutorAddress.should.be.equal(singlePullPayment.pullPaymentExecutorAddress);
      logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
    });
  });

  describe('Execute Recurring Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientTwo
      });
    });

    beforeEach('set recurring pull payment details', async () => {
      const ethDate = await currentBlockTime();
      recurringPullPayment.frequency = 1000000 * YEAR;
      recurringPullPayment.startTimestamp = ethDate;
    });

    beforeEach('Add recurring pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPayment.paymentID, recurringPullPayment.businessID, recurringPullPayment.uniqueReferenceID ],
        [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
        recurringPullPayment.currency,
        recurringPullPayment.initialPaymentAmountInCents,
        recurringPullPayment.fiatAmountInCents,
        recurringPullPayment.frequency,
        recurringPullPayment.numberOfPayments,
        recurringPullPayment.startTimestamp,
        {
          from: executorOne
        });
    });

    it('should pull the amount specified on the payment details to the beneficiary', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
      Number(beneficiaryBalance).should.be.equal(100 * ONE_ETHER);
    });

    it('should update the pull payment numberOfPayments', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, facilitatorTwo);

      String(pullPayment[ 7 ]).should.be
        .equal(String(web3API.utils.toBN(recurringPullPayment.numberOfPayments - 1))); // NUMBER OF ALLOWED PULL PAYMENTS
    });

    it('should update the pull payment nextPaymentTimestamp', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, facilitatorTwo);
      String(pullPayment[ 9 ]).should.be
        .equal(String(web3API.utils.toBN(recurringPullPayment.startTimestamp + recurringPullPayment.frequency))); // NEXT PAYMENT TS
    });

    it('should update the pull payment lastPaymentTimestamp', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const ethDate = await currentBlockTime();
      const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, facilitatorTwo);

      String(pullPayment[ 10 ]).should.be.equal(String(web3API.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
    });

    it('should execute the next payment when next payment date is reached', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await timeTravel(1000000 * YEAR);
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
      Number(beneficiaryBalance).should.be.equal(200 * ONE_ETHER);
    });

    it('should revert when if the next payment date is NOT reached', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      await timeTravel(1000000 * YEAR - DAY);
      await assertRevert(pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      }));
    });

    it('should allow the merchant to pull payments in case they have missed few payments', async () => {
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      await timeTravel(4000000 * YEAR); // 4 more payments are allowed!
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
      Number(beneficiaryBalance).should.be.equal(500 * ONE_ETHER);
      await assertRevert(pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      }));
    });

    it('should allow the merchant to pull payments in case they have missed few payments and the customer cancelled the subscription', async () => {
      await timeTravel(2000000 * YEAR + DAY); // 3 paymets are allowed!
      const signature = await calcSignedMessageForDeletion(recurringPullPayment.paymentID, facilitatorTwo, CLIENT_TWO_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        recurringPullPayment.paymentID,
        recurringPullPayment.client,
        facilitatorTwo, {
          from: executorOne
        });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });
      await pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);
      // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
      Number(beneficiaryBalance).should.be.equal(300 * ONE_ETHER);
      await assertRevert(pumaPayPullPayment.executePullPayment(clientTwo, facilitatorTwo, recurringPullPayment.paymentID, {
        from: facilitatorTwo
      }));
    });
  });

  describe('Execute Recurring Pull Payment with initial amount', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('add executors', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('approve PumaPay Pull Payment  to transfer from third client\'s account ', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientThree
      });
    });

    beforeEach('set recurring pull payment with initial amount details', async () => {
      const ethDate = await currentBlockTime();
      recurringPullPaymentWithInitialAmount.startTimestamp = ethDate + DAY;
    });

    beforeEach('Add recurring pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(recurringPullPaymentWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ recurringPullPaymentWithInitialAmount.paymentID,
          recurringPullPaymentWithInitialAmount.businessID,
          recurringPullPaymentWithInitialAmount.uniqueReferenceID ],
        [ recurringPullPaymentWithInitialAmount.client,
          recurringPullPaymentWithInitialAmount.pullPaymentExecutorAddress,
          recurringPullPaymentWithInitialAmount.treasuryAddress ],
        recurringPullPaymentWithInitialAmount.currency,
        recurringPullPaymentWithInitialAmount.initialPaymentAmountInCents,
        recurringPullPaymentWithInitialAmount.fiatAmountInCents,
        recurringPullPaymentWithInitialAmount.frequency,
        recurringPullPaymentWithInitialAmount.numberOfPayments,
        recurringPullPaymentWithInitialAmount.startTimestamp,
        {
          from: executorOne
        });
    });

    it('should pull the initial amount specified on the payment details to the beneficiary', async () => {
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);

      Number(beneficiaryBalance).should.be.equal(50 * ONE_ETHER);
    });

    it('should pull the amount of the first payment specified for the reccuring payment to the beneficiary after receiving the initial payment', async () => {
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);

      Number(beneficiaryBalance).should.be.equal(150 * ONE_ETHER);
    });

    it('should pull the amount of the second payment specified for the reccuring payment to the beneficiary', async () => {
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });
      await timeTravel(DAY);
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });
      await timeTravel(2 * DAY);
      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });

      const beneficiaryBalance = await token.balanceOf(treasuryAddress);

      Number(beneficiaryBalance).should.be.equal(250 * ONE_ETHER);
    });

    it('should set the intial payment amount to ZERO after pulling it', async () => {
      const pullPaymentBefore = await pumaPayPullPayment.pullPayments(clientThree, facilitatorThree);
      String(pullPaymentBefore[ 4 ]).should.be
        .equal(String(web3API.utils.toBN(recurringPullPaymentWithInitialAmount.initialPaymentAmountInCents))); // INITIAL AMOUNT

      await pumaPayPullPayment.executePullPayment(clientThree, facilitatorThree, recurringPullPaymentWithInitialAmount.paymentID, {
        from: facilitatorThree
      });
      const pullPaymentAfter = await pumaPayPullPayment.pullPayments(clientThree, facilitatorThree);
      const ethDate = await currentBlockTime();

      String(pullPaymentAfter[ 4 ]).should.be.equal(String(web3API.utils.toBN(0))); // INITIAL AMOUNT
      String(pullPaymentAfter[ 10 ]).should.be.equal(String(web3API.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
    });
  });
});

contract('PumaPay Pull Payment Contract For Funding', async (accounts) => {
  const deployerAccount = accounts[ 0 ];    // 0xe689c075c808404C9A0d84bE10d2E960CC61c497
  const owner = accounts[ 1 ];              // 0x853C292e80e2ba1f93F33Af6046C3A0B2EaE47Dc
  const executorOne = accounts[ 2 ];        // 0xf52DBA6fe86D2f80c13F2e2565F521Ad0C18Efc0
  const facilitatorOne = accounts[ 4 ];     // 0x3D76b36e4F76D7220001F21Cf0C70F2fb5799e6b
  const clientOne = accounts[ 7 ];          // 0xb2F990cCC50Da372307b080501BfA4703c1C499B
  const clientTwo = accounts[ 8 ];          // 0x34bfe2E8cbec8d0263Cd24c67166022C2D350614
  const clientThree = accounts[ 9 ];        // 0xc4771Be5D994847bE5B846E7126A0F73c6A0B144
  const treasuryAddress = accounts[ 10 ];

  const gasPrice = 1000000000;

  let singlePullPayment = {
    paymentID: web3API.utils.fromAscii('paymentID_1'),
    businessID: web3API.utils.fromAscii('businessID_1'),
    uniqueReferenceID: web3API.utils.fromAscii('uniqueReferenceID_1'),
    client: clientOne,
    pullPaymentExecutorAddress: facilitatorOne,
    currency: 'EUR',
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 100000000, // 1 million in EUR cents
    frequency: 1,
    numberOfPayments: 1,
    startTimestamp: Math.floor(Date.now() / 1000) + DAY,
    treasuryAddress: treasuryAddress
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

  const transferEthersToSmartContract = async (ethers, fromAccount, smartContract) => {
    await smartContract.sendTransaction(
      {
        from: fromAccount,
        value: ethers * ONE_ETHER
      }
    );
  };

  describe('Set Rate', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
    });
    afterEach('Transfer ETH to owner account', async () => {
      await web3API.eth.sendTransaction({
        from: deployerAccount,
        to: owner,
        value: 5 * ONE_ETHER
      });
    });
    it('should transfer ETH to the owner when its balance is lower than 0.01 ETH and set the rate', async () => {
      const ownerBalance = await web3API.eth.getBalance(owner);
      await web3API.eth.sendTransaction({
        from: owner,
        to: deployerAccount,
        value: ownerBalance - 0.15 * ONE_ETHER
      });
      const ownerBalanceBefore = await web3API.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * gasPrice;

      const ownerBalanceAfter = await web3API.eth.getBalance(owner);
      const euroRate = await pumaPayPullPayment.getRate('EUR');

      String(euroRate).should.be.equal(String(web3API.utils.toBN(EUR_EXCHANGE_RATE)));
      String(ownerBalanceAfter - ownerBalanceBefore + txFee).should.be.equal(String(web3API.utils.toBN(ONE_ETHER)));
    });
  });

  describe('Add Executor', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
    });
    afterEach('Transfer ETH to owner account', async () => {
      await web3API.eth.sendTransaction({
        from: deployerAccount,
        to: owner,
        value: 5 * ONE_ETHER
      });
    });

    it('should transfer ETH to the owner when its balance is lower than 0.01 ETH', async () => {
      const ownerBalance = await web3API.eth.getBalance(owner);
      await web3API.eth.sendTransaction({
        from: owner,
        to: deployerAccount,
        value: ownerBalance - 0.01 * ONE_ETHER
      });
      const ownerBalanceBefore = await web3API.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * gasPrice;

      const ownerBalanceAfter = await web3API.eth.getBalance(owner);
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(executor, true);
      String(ownerBalanceAfter - ownerBalanceBefore + txFee).should.be.equal(String(web3API.utils.toBN(ONE_ETHER)));
    });
  });

  describe('Remove Executor', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    afterEach('Transfer ETH to owner account', async () => {
      await web3API.eth.sendTransaction({
        from: deployerAccount,
        to: owner,
        value: 5 * ONE_ETHER
      });
    });
    it('should transfer ETH to the owner when its balance is lower than 0.01 ETH', async () => {
      const ownerBalance = await web3API.eth.getBalance(owner);
      await web3API.eth.sendTransaction({
        from: owner,
        to: deployerAccount,
        value: ownerBalance - 0.01 * ONE_ETHER
      });
      const ownerBalanceBefore = await web3API.eth.getBalance(owner);
      const transaction = await pumaPayPullPayment.removeExecutor(executorOne, {
        from: owner
      });
      const txFee = Number(transaction.receipt.gasUsed) * gasPrice;

      const ownerBalanceAfter = await web3API.eth.getBalance(owner);
      const executor = await pumaPayPullPayment.executors(executorOne);

      assert.equal(executor, false);
      String(ownerBalanceAfter - ownerBalanceBefore + txFee).should.be.equal(String(web3API.utils.toBN(ONE_ETHER)));
    });
  });

  describe('Register Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(3, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    it('should transfer ETH to the executor when its balance is lower than 0.01 ETH and register a pull payment', async () => {
      const executorBalance = await web3API.eth.getBalance(executorOne);
      await web3API.eth.sendTransaction({
        from: executorOne,
        to: deployerAccount,
        value: executorBalance - 0.01 * ONE_ETHER
      });
      const executorBalanceBefore = await web3API.eth.getBalance(executorOne);

      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const transaction = await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorOne
        });

      const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
      const executorBalanceAfter = await web3API.eth.getBalance(executorOne);
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      String(executorBalanceAfter - executorBalanceBefore + txFee).should.be.equal(String(web3API.utils.toBN(ONE_ETHER)));

      activePaymentInArray[ 0 ].should.be.equal(singlePullPayment.paymentID); // PAYMENT ID
      activePaymentInArray[ 1 ].should.be.equal(singlePullPayment.businessID); // BUSINESS ID
      activePaymentInArray[ 2 ].should.be.equal(singlePullPayment.uniqueReferenceID); // UNIQUE REFERENCE ID
      activePaymentInArray[ 3 ].should.be.equal(singlePullPayment.currency); // CURRENCY
      String(activePaymentInArray[ 4 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.initialPaymentAmountInCents))); // INITIAL AMOUNT
      String(activePaymentInArray[ 5 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.fiatAmountInCents))); // FIAT AMOUNT
      String(activePaymentInArray[ 6 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.frequency))); // FREQUENCY
      String(activePaymentInArray[ 7 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.numberOfPayments))); // NUMBER OF ALLOWED PULL PAYMENTS
      String(activePaymentInArray[ 8 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.startTimestamp))); // START TIMESTAMP
      String(activePaymentInArray[ 9 ]).should.be
        .equal(String(web3API.utils.toBN(singlePullPayment.startTimestamp))); // NEXT PAYMENT TIMESTAMP = START TIMESTAMP
      String(activePaymentInArray[ 10 ]).should.be.equal(String(web3API.utils.toBN(0))); // LAST PAYMENT TIMESTAMP
      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3API.utils.toBN(0))); // CANCEL PAYMENT TIMESTAMP
      activePaymentInArray[ 12 ].should.be.equal(treasuryAddress); // TREASURY ADDRESS
    });
  });

  describe('Delete Pull Payment', async () => {
    beforeEach('Transfer ETH to smart contract', async () => {
      await transferEthersToSmartContract(3, deployerAccount, pumaPayPullPayment);
    });
    beforeEach('Add executor ETH to smart contract', async () => {
      await pumaPayPullPayment.addExecutor(executorOne, {
        from: owner
      });
    });
    beforeEach('Add single pull payment', async () => {
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.registerPullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID, singlePullPayment.uniqueReferenceID ],
        [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
        singlePullPayment.currency,
        singlePullPayment.initialPaymentAmountInCents,
        singlePullPayment.fiatAmountInCents,
        singlePullPayment.frequency,
        singlePullPayment.numberOfPayments,
        singlePullPayment.startTimestamp,
        {
          from: executorOne
        });
    });

    it('should transfer ETH to the executor when its balance is lower than 0.01 ETH', async () => {
      const executorBalance = await web3API.eth.getBalance(executorOne);
      await web3API.eth.sendTransaction({
        from: executorOne,
        to: deployerAccount,
        value: executorBalance - 0.01 * ONE_ETHER
      });
      const executorBalanceBefore = await web3API.eth.getBalance(executorOne);
      const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, singlePullPayment.pullPaymentExecutorAddress, CLIENT_ONE_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const transaction = await pumaPayPullPayment.deletePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        singlePullPayment.paymentID,
        singlePullPayment.client,
        singlePullPayment.pullPaymentExecutorAddress, {
          from: executorOne
        });

      const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
      const executorBalanceAfter = await web3API.eth.getBalance(executorOne);
      const ethDate = await currentBlockTime();
      const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);

      String(activePaymentInArray[ 11 ]).should.be.equal(String(web3API.utils.toBN(ethDate))); // CANCEL PAYMENT TS
      String(executorBalanceAfter - executorBalanceBefore + txFee).should.be.equal(String(web3API.utils.toBN(ONE_ETHER)));
    });
  });
});