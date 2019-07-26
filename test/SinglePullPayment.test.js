const {assertRevert} = require('./helpers/assertionHelper');
const {
  calcSignedMessageForRegistration,
  calcSignedMessageForRegistrationV2,
  calcSignedMessageToMakeSinglePullPayment,
  getVRS
} = require('./helpers/signatureCalculator');
const PumaPayToken = artifacts.require('MockMintableToken');

const PumaPayPullPayment = artifacts.require('SinglePullPayment');
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
  const deployerAccount = accounts[ 0 ];
  const owner = accounts[ 1 ];
  const executor = accounts[ 2 ];
  const clientOne = accounts[ 3 ];
  const treasuryAddress = accounts[ 4 ];

  let token;
  let pumaPayPullPayment;

  let singlePullPayment = {
    paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
    businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
    uniqueReferenceID: 'uniqueReferenceID_1',
    paymentType: web3.utils.padRight(web3.utils.fromAscii('2'), 64),
    client: clientOne,
    pullPaymentExecutorAddress: executor,
    currency: 'EUR',
    initialConversionRate: 10000,
    initialPaymentAmountInCents: 0,
    fiatAmountInCents: 100000000, // 1 million in EUR cents
    amountInPMA: web3.utils.toWei('10', 'ether'),
    frequency: 1,
    numberOfPayments: 1,
    startTimestamp: Math.floor(Date.now() / 1000) + DAY,
    treasuryAddress: treasuryAddress,
    trialPeriod: 0
  };

  beforeEach('Deploying new PumaPayToken', async () => {
    token = await PumaPayToken.new({
      from: deployerAccount
    });
  });

  beforeEach('Deploying new PumaPay Single Pull Payment', async () => {
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
        }));
    });
  });

  describe('Add executor', async () => {
    it('should set the executor specified to true', async () => {
      await pumaPayPullPayment.addExecutor(executor, {
        from: owner
      });
      const executorOnSmartContract = await pumaPayPullPayment.executors(executor);

      assert.equal(executorOnSmartContract, true);
    });

    it('should revert when the executor is a ZERO address', async () => {
      await assertRevert(
        pumaPayPullPayment.addExecutor(ZERO_ADDRESS, {
          from: owner
        })
      );
    });

    it('should revert when the adding the same executor', async () => {
      await pumaPayPullPayment.addExecutor(executor, {
        from: owner
      });
      await assertRevert(
        pumaPayPullPayment.addExecutor(executor, {
          from: owner
        })
      );
    });

    it('should revert if NOT executed by the owner', async () => {
      await pumaPayPullPayment.addExecutor(executor, {
        from: owner
      });

      await assertRevert(
        pumaPayPullPayment.addExecutor(deployerAccount, {
          from: executor
        })
      );
    });
  });

  describe('Remove executor', async () => {
    beforeEach('add an executor', async () => {
      await pumaPayPullPayment.addExecutor(executor, {
        from: owner
      });
    });

    it('should set the executor specified to false', async () => {
      await pumaPayPullPayment.removeExecutor(executor, {
        from: owner
      });
      const executorOnSmartContract = await pumaPayPullPayment.executors(executor);

      assert.equal(executorOnSmartContract, false);
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
        pumaPayPullPayment.removeExecutor(deployerAccount, {
          from: owner
        })
      );
    });

    it('should revert if NOT executed by the owner', async () => {
      await assertRevert(
        pumaPayPullPayment.removeExecutor(executor, {
          from: executor
        })
      );
    });
  });

  describe('Make a pull payment', async () => {
    beforeEach('add an executor', async () => {
      await pumaPayPullPayment.addExecutor(executor, {
        from: owner
      });
    });

    it('should add the pull payment in the mapping', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: executor
        });

      const pullPaymentInArray = await pumaPayPullPayment.pullPayments(singlePullPayment.paymentID);

      String(pullPaymentInArray[ 0 ]).should.be.equal(String(web3.utils.toBN(singlePullPayment.amountInPMA))); // paymentAmount
      pullPaymentInArray[ 1 ].should.be.equal(singlePullPayment.client); // customer address
      pullPaymentInArray[ 2 ].should.be.equal(singlePullPayment.treasuryAddress); // receiver address
      pullPaymentInArray[ 3 ].should.be.equal(singlePullPayment.uniqueReferenceID); // unique Reference ID
    });
    it('should transfer the PMA to the treasury wallet', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: executor
        });

      const treasuryBalanceAfter = await token.balanceOf(treasuryAddress);

      String(treasuryBalanceAfter).should.be.equal(String(singlePullPayment.amountInPMA));
    });
    it('should emit a "LogPaymentPulled" event', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      const pullPaymentResult = await pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: executor
        });

      const logs = pullPaymentResult.logs;

      assert.equal(logs.length, 1);
      assert.equal(logs[ 0 ].event, 'LogPaymentPulled');
      logs[ 0 ].args.customerAddress.should.be.equal(singlePullPayment.client);
      logs[ 0 ].args.receiverAddress.should.be.equal(singlePullPayment.treasuryAddress);
      String(logs[ 0 ].args.amountInPMA).should.be.equal(String(singlePullPayment.amountInPMA));
      logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
      logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
      logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
    });
    it('should fail if not sent by the executor', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
    });
    it('should fail if paymentID is not valid', async () => {
      singlePullPayment.paymentID = web3.utils.padRight(web3.utils.fromAscii(''), 64);
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.paymentID = web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64);
    });
    it('should fail if businessID is not valid', async () => {
      singlePullPayment.businessID = web3.utils.padRight(web3.utils.fromAscii(''), 64);
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.businessID = web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64);
    });
    it('should fail if payment amount is not valid - ZERO', async () => {
      singlePullPayment.amountInPMA = 0;
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.amountInPMA = web3.utils.toWei('10', 'ether');
    });

    it('should fail if payment amount is not valid - ZERO', async () => {
      singlePullPayment.amountInPMA = '1000000000000000000000'; // 10^21
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.amountInPMA = web3.utils.toWei('10', 'ether');
    });

    it('should fail if customer address is not valid', async () => {
      singlePullPayment.client = ZERO_ADDRESS;
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.client = clientOne;
    });
    it('should fail if treasury address is not valid', async () => {
      singlePullPayment.treasuryAddress = ZERO_ADDRESS;
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));

      singlePullPayment.treasuryAddress = treasuryAddress;
    });
    it('should fail if the payment exists already i.e. re-registering a pull payment', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: executor
        });
      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
    });
    it('should fail if signature validation fails - send different value on the blockchain', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);
      singlePullPayment.amountInPMA = '11111111111';

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
      singlePullPayment.amountInPMA = web3.utils.toWei('10', 'ether');
    });
    it('should fail if signature validation fails - sign different parameters - V1 signature', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
      singlePullPayment.amountInPMA = web3.utils.toWei('10', 'ether');
    });
    it('should fail if signature validation fails - sign different parameters - V2 signature', async () => {
      await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
        from: clientOne
      });
      const signature = await calcSignedMessageForRegistrationV2(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
      singlePullPayment.amountInPMA = web3.utils.toWei('10', 'ether');
    });
    it('should fail if the customer doesn\'t approve the pull payument smart contract', async () => {
      const signature = await calcSignedMessageToMakeSinglePullPayment(singlePullPayment, CLIENT_PRIVATE_KEY);
      const sigVRS = await getVRS(signature);

      await assertRevert(pumaPayPullPayment.makePullPayment(
        sigVRS.v,
        sigVRS.r,
        sigVRS.s,
        [ singlePullPayment.paymentID, singlePullPayment.businessID ],
        [ singlePullPayment.client, singlePullPayment.treasuryAddress ],
        singlePullPayment.amountInPMA,
        singlePullPayment.uniqueReferenceID,
        {
          from: deployerAccount
        }));
    });
  });
});
