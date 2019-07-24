// const {assertRevert} = require('./helpers/assertRevert');
//
// const {timeTravel, currentBlockTime} = require('./helpers/timeHelper');
// const {
//   calcSignedMessageForRegistration,
//   calcSignedMessageForDeletion,
//   getVRS
// } = require('./helpers/signatureCalculator');
// const PumaPayToken = artifacts.require('MockMintableToken');
//
// const PumaPayPullPayment = artifacts.require('PumaPayPullPayment');
// const BigNumber = web3.BigNumber;
//
// require('chai')
//   .use(require('chai-as-promised'))
//   .use(require('chai-bignumber')(BigNumber))
//   .should();
//
// const MINUTE = 60; // 60 seconds
// const HOUR = 60 * MINUTE;
// const DAY = 24 * HOUR;
// const YEAR = 365 * DAY;
//
// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
//
// const ONE_ETHER = web3.utils.toWei('1', 'ether');
// const FUNDING_AMOUNT = web3.utils.toWei('0.5', 'ether');
// const MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS = 0.15;
// const DECIMAL_FIXER = 10 ** 10;
// const MINTED_TOKENS = web3.utils.toWei('90000000000', 'ether'); // 90 Billion PMA
// const EUR_EXCHANGE_RATE = 0.01 * DECIMAL_FIXER; // 1 PMA = 0.01 EUR
// const USD_EXCHANGE_RATE = 0.02 * DECIMAL_FIXER; // 1 PMA = 0.02 USD
//
// const CLIENT_ONE_PRIVATE_KEY = '0x581a2b62e840bae3e56685c5ede97d0cb1f252fa7937026dcac489074b01fc29';
// const CLIENT_TWO_PRIVATE_KEY = '0xc5459c6743cd4fe5a89c3fc994c2bdfd5dbac6ecd750f642bd2e272d9fa0852d';
// const CLIENT_THREE_PRIVATE_KEY = '0x7f201ee20596c003b979ba39018b08cd7920abbc04a9d1bb984aa8be421db541';
//
// const transferEthersToSmartContract = async (ethers, fromAccount, smartContract) => {
//   await smartContract.sendTransaction(
//     {
//       from: fromAccount,
//       value: ethers * ONE_ETHER
//     }
//   );
// };
//
// contract('PumaPay Pull Payment Contract', async (accounts) => {
//   const deployerAccount = accounts[ 0 ];
//   const owner = accounts[ 1 ];
//   const executorOne = accounts[ 2 ];
//   const executorTwo = accounts[ 3 ];
//   const paymentExecutorOne = accounts[ 4 ];
//   const paymentExecutorTwo = accounts[ 5 ];
//   const paymentExecutorThree = accounts[ 6 ];
//   const clientOne = accounts[ 7 ];
//   const clientTwo = accounts[ 8 ];
//   const clientThree = accounts[ 9 ];
//   const treasuryAddress = accounts[ 10 ];
//
//   let singlePullPayment = {
//     paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
//     businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
//     uniqueReferenceID: 'uniqueReferenceID_1',
//     client: clientOne,
//     pullPaymentExecutorAddress: paymentExecutorOne,
//     currency: 'EUR',
//     initialPaymentAmountInCents: 0,
//     fiatAmountInCents: 100000000, // 1 million in EUR cents
//     frequency: 1,
//     numberOfPayments: 1,
//     startTimestamp: Math.floor(Date.now() / 1000) + DAY,
//     treasuryAddress: treasuryAddress
//   };
//
//   let recurringPullPayment = {
//     paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_2'), 64),
//     businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_2'), 64),
//     uniqueReferenceID: 'uniqueReferenceID_2',
//     client: clientTwo,
//     pullPaymentExecutorAddress: paymentExecutorTwo,
//     currency: 'USD',
//     initialPaymentAmountInCents: 0,
//     fiatAmountInCents: 200, // 2.00 USD in cents
//     frequency: 2 * DAY,
//     numberOfPayments: 10,
//     startTimestamp: Math.floor(Date.now() / 1000) + DAY,
//     treasuryAddress: treasuryAddress
//   };
//
//   let recurringPullPaymentWithInitialAmount = {
//     paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_3'), 64),
//     businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_3'), 64),
//     uniqueReferenceID: 'uniqueReferenceID_3',
//     client: clientThree,
//     pullPaymentExecutorAddress: paymentExecutorThree,
//     currency: 'USD',
//     initialPaymentAmountInCents: 100,
//     fiatAmountInCents: 200, // 2.00 USD in cents
//     frequency: 2 * DAY,
//     numberOfPayments: 10,
//     startTimestamp: Math.floor(Date.now() / 1000) + 2 * DAY,
//     treasuryAddress: treasuryAddress
//   };
//
//   let token;
//   let pumaPayPullPayment;
//
//
//   beforeEach('Deploying new PumaPayToken', async () => {
//     token = await PumaPayToken.new({
//       from: deployerAccount
//     });
//   });
//
//   beforeEach('Deploying new PumaPay Pull Payment', async () => {
//     pumaPayPullPayment = await PumaPayPullPayment
//       .new(token.address, {
//         from: owner
//       });
//   });
//
//   beforeEach('Issue tokens to the clients', async () => {
//     const tokens = MINTED_TOKENS;
//     await token.mint(clientOne, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientTwo, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientThree, tokens, {
//       from: deployerAccount
//     });
//   });
//
//   beforeEach('set the rate for multiple fiat currencies', async () => {
//     await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
//       from: owner
//     });
//     await pumaPayPullPayment.setRate('USD', USD_EXCHANGE_RATE, {
//       from: owner
//     });
//   });
//
//   describe('Deploying', async () => {
//     it('PumaPay Pull Payment owner should be the address that was specified on contract deployment', async () => {
//       const accountOwner = await pumaPayPullPayment.owner();
//
//       assert.equal(accountOwner.toString(), owner);
//     });
//
//     it('PumaPay Pull Payment token should be the token address specified on contract deployment', async () => {
//       const accountToken = await pumaPayPullPayment.token();
//
//       assert.equal(accountToken, token.address);
//     });
//
//     it('PumaPay Pull Payment deployment should revert when the token is a ZERO address', async () => {
//       await assertRevert(PumaPayPullPayment
//         .new(ZERO_ADDRESS, {
//           from: deployerAccount
//         }));
//     });
//   });
//
//   describe('Add executor', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//
//     it('should set the executor specified to true', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//       const executor = await pumaPayPullPayment.executors(executorOne);
//
//       assert.equal(executor, true);
//     });
//
//     it('should transfer ETHER to the executor account for paying gas fees', async () => {
//       const executorBalanceBefore = await web3.eth.getBalance(executorOne);
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//       const executorBalanceAfter = await web3.eth.getBalance(executorOne);
//       const expectedBalance = web3.utils.fromWei(String(executorBalanceAfter), 'ether') - web3.utils.fromWei(String(executorBalanceBefore), 'ether');
//
//       assert.equal(String(expectedBalance), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//     });
//
//     it('should revert when the executor is a ZERO address', async () => {
//       await assertRevert(
//         pumaPayPullPayment.addExecutor(ZERO_ADDRESS, {
//           from: owner
//         })
//       );
//     });
//
//     it('should revert when the adding the same executor', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//       await assertRevert(
//         pumaPayPullPayment.addExecutor(executorOne, {
//           from: owner
//         })
//       );
//     });
//
//     it('should revert if NOT executed by the owner', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//
//       await assertRevert(
//         pumaPayPullPayment.addExecutor(executorTwo, {
//           from: executorOne
//         })
//       );
//     });
//   });
//
//   describe('Remove executor', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//
//     beforeEach('add an executor', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//
//     it('should set the executor specified to false', async () => {
//       await pumaPayPullPayment.removeExecutor(executorOne, {
//         from: owner
//       });
//       const executor = await pumaPayPullPayment.executors(executorOne);
//
//       assert.equal(executor, false);
//     });
//
//     it('should revert when the executor is a ZERO address', async () => {
//       await assertRevert(
//         pumaPayPullPayment.removeExecutor(ZERO_ADDRESS, {
//           from: owner
//         })
//       );
//     });
//
//     it('should revert when the executor does not exists', async () => {
//       await assertRevert(
//         pumaPayPullPayment.removeExecutor(executorTwo, {
//           from: owner
//         })
//       );
//     });
//
//     it('should revert if NOT executed by the owner', async () => {
//       await assertRevert(
//         pumaPayPullPayment.removeExecutor(executorTwo, {
//           from: executorOne
//         })
//       );
//     });
//   });
//
//   describe('Set Rate', async () => {
//     it('should set the rate for fiat currency', async () => {
//       await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE * 10, {
//         from: owner
//       });
//       const euroRate = await pumaPayPullPayment.getRate('EUR');
//       String(euroRate).should.be.equal(String(web3.utils.toBN(EUR_EXCHANGE_RATE * 10)));
//     });
//
//     it('should set the rate for multiple fiat currencies', async () => {
//       const euroRate = await pumaPayPullPayment.getRate('EUR');
//       const usdRate = await pumaPayPullPayment.getRate('USD');
//
//       String(euroRate).should.be.equal(String(web3.utils.toBN(EUR_EXCHANGE_RATE)));
//       String(usdRate).should.be.equal(String(web3.utils.toBN(USD_EXCHANGE_RATE)));
//     });
//
//     it('should revert when not executed by the owner', async () => {
//       await assertRevert(pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
//         from: deployerAccount
//       }));
//     });
//
//     it('should allow everyone to retrieve the rate', async () => {
//       const usdRate = await pumaPayPullPayment.getRate('USD', {
//         from: deployerAccount
//       });
//
//       String(usdRate).should.be.equal(String(web3.utils.toBN(USD_EXCHANGE_RATE)));
//     });
//
//     it('should emit a "LogSetConversionRate" event', async () => {
//       const setRate = await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
//         from: owner
//       });
//       const logs = setRate.logs;
//
//       assert.equal(logs.length, 1);
//       assert.equal(logs[ 0 ].event, 'LogSetConversionRate');
//       logs[ 0 ].args.currency.should.be.equal('EUR');
//       String(logs[ 0 ].args.conversionRate).should.be.equal(String(web3.utils.toBN(EUR_EXCHANGE_RATE)));
//     });
//   });
//
//   describe('Register Pull Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('add executors', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     it('should add the pull payment for the beneficiary in the active payments array', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         }
//       );
//
//       const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, paymentExecutorOne);
//
//       activePaymentInArray[ 0 ].should.be.equal(singlePullPayment.paymentID); // PAYMENT ID
//       activePaymentInArray[ 1 ].should.be.equal(singlePullPayment.businessID); // BUSINESS ID
//       activePaymentInArray[ 2 ].should.be.equal(singlePullPayment.uniqueReferenceID); // UNIQUE REFERENCE ID
//       activePaymentInArray[ 3 ].should.be.equal(singlePullPayment.currency); // CURRENCY
//       String(activePaymentInArray[ 4 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.initialPaymentAmountInCents))); // INITIAL AMOUNT
//       String(activePaymentInArray[ 5 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.fiatAmountInCents))); // FIAT AMOUNT
//       String(activePaymentInArray[ 6 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.frequency))); // FREQUENCY
//       String(activePaymentInArray[ 7 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.numberOfPayments))); // NUMBER OF ALLOWED PULL PAYMENTS
//       String(activePaymentInArray[ 8 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp))); // START TIMESTAMP
//       String(activePaymentInArray[ 9 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp))); // NEXT PAYMENT TIMESTAMP = START TIMESTAMP
//       String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(0))); // LAST PAYMENT TIMESTAMP
//       String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(0))); // CANCEL PAYMENT TIMESTAMP
//       activePaymentInArray[ 12 ].should.be.equal(treasuryAddress); // TREASURY ADDRESS
//     });
//
//     it('should revert when NOT executed an executor', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await assertRevert(pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: deployerAccount
//         }));
//     });
//
//     it('should revert when the pull payment params does match with the ones signed by the signatory', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await assertRevert(pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ recurringPullPayment.paymentID, recurringPullPayment.businessID ],
//         [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
//         recurringPullPayment.currency,
//         recurringPullPayment.uniqueReferenceID,
//         recurringPullPayment.initialPaymentAmountInCents,
//         recurringPullPayment.fiatAmountInCents,
//         recurringPullPayment.frequency,
//         recurringPullPayment.numberOfPayments,
//         recurringPullPayment.startTimestamp,
//         {
//           from: executorOne
//         }));
//     });
//
//
//     it('should emit a "LogPaymentRegistered" event', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       const pumaPayPullPaymentRegistration = await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//
//       const logs = pumaPayPullPaymentRegistration.logs;
//
//       assert.equal(logs.length, 1);
//       assert.equal(logs[ 0 ].event, 'LogPaymentRegistered');
//       logs[ 0 ].args.customerAddress.should.be.equal(singlePullPayment.client);
//       logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
//       logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
//       logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
//     });
//   });
//
//   describe('Delete Recurring Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('add executors', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//       await pumaPayPullPayment.addExecutor(executorTwo, {
//         from: owner
//       });
//     });
//     beforeEach('Add single pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//     });
//
//     beforeEach('Add recurring pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ recurringPullPayment.paymentID, recurringPullPayment.businessID ],
//         [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         recurringPullPayment.currency,
//         recurringPullPayment.uniqueReferenceID,
//         recurringPullPayment.initialPaymentAmountInCents,
//         recurringPullPayment.fiatAmountInCents,
//         recurringPullPayment.frequency,
//         recurringPullPayment.numberOfPayments,
//         recurringPullPayment.startTimestamp,
//         {
//           from: executorTwo
//         });
//     });
//
//     it('should set the cancel date of the pull payment for the paymentExecutorOne to NOW', async () => {
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, singlePullPayment.pullPaymentExecutorAddress, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         singlePullPayment.pullPaymentExecutorAddress, {
//           from: executorOne
//         });
//       const ethDate = await currentBlockTime();
//       const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, paymentExecutorOne);
//
//       String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // CANCEL PAYMENT TIMESTAMP
//     });
//
//     it('should revert when NOT executed by an executor', async () => {
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, paymentExecutorOne, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await assertRevert(pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         paymentExecutorOne, {
//           from: owner
//         }));
//     });
//
//     it('should revert when the payment for the beneficiary does not exists', async () => {
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, paymentExecutorOne, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await assertRevert(pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         paymentExecutorThree, {
//           from: executorOne
//         }));
//     });
//
//     it('should revert when the deletion pull payment params does match with the ones signed by the signatory', async () => {
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, paymentExecutorOne, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await assertRevert(pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         paymentExecutorTwo, {
//           from: executorOne
//         }));
//     });
//
//     it('should emit a "LogPaymentCancelled" event', async () => {
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, paymentExecutorOne, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       const pumaPayPullPaymentDeletion = await pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         paymentExecutorOne, {
//           from: executorTwo
//         });
//
//       const logs = pumaPayPullPaymentDeletion.logs;
//
//       assert.equal(logs.length, 1);
//       assert.equal(logs[ 0 ].event, 'LogPaymentCancelled');
//       logs[ 0 ].args.customerAddress.should.be.equal(singlePullPayment.client);
//       logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
//       logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
//       logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
//     });
//   });
//
//   describe('Execute Single Pull Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('add executors', async () => {
//       await pumaPayPullPayment.addExecutor(executorTwo, {
//         from: owner
//       });
//     });
//
//     beforeEach('approve PumaPay Pull Payment  to transfer from first client\'s account ', async () => {
//       await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
//         from: clientOne
//       });
//     });
//
//     beforeEach('set simple pull payment details', async () => {
//       const ethDate = await currentBlockTime();
//       singlePullPayment.startTimestamp = ethDate + DAY;
//     });
//
//     beforeEach('Add single pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorTwo
//         });
//     });
//
//     it('should pull the amount specified on the payment details to the paymentExecutorOne', async () => {
//       await timeTravel(DAY + 1);
//       await pumaPayPullPayment.executePullPayment(singlePullPayment.client, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorOne
//         });
//
//       const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.01 EUR ==> 1 EUR = 100 PMA ==> 1000000 EUR = 100000000 PMA
//       Number(balanceOfTreasuryAfter).should.be.equal(100000000 * ONE_ETHER);
//     });
//
//     it('should update the pull payment numberOfPayments', async () => {
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments, {
//         from: paymentExecutorOne
//       });
//
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, paymentExecutorOne);
//
//       String(pullPayment[ 7 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.numberOfPayments - 1))); // NUMBER OF PAYMENTS
//     });
//
//     it('should update the pull payment nextPaymentTimestamp', async () => {
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments, {
//         from: paymentExecutorOne
//       });
//
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, paymentExecutorOne);
//       String(pullPayment[ 9 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp + singlePullPayment.frequency))); // NEXT PAYMENT TIMESTAMP
//     });
//
//     it('should update the pull payment lastPaymentTimestamp', async () => {
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments, {
//         from: paymentExecutorOne
//       });
//       const ethDate = await currentBlockTime();
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientOne, paymentExecutorOne);
//
//       String(pullPayment[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
//     });
//
//     it('should revert if NOT executed by the executor', async () => {
//       await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//
//     it('should revert if executed before the start date specified in the payment', async () => {
//       await timeTravel(DAY - 10);
//       await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorOne
//         }));
//     });
//
//     it('should revert when executed twice, i.e. number of payments is zero', async () => {
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments, {
//         from: paymentExecutorOne
//       });
//
//       await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorOne
//         }));
//     });
//
//     it('should revert when pull payment does not exists for beneficiary calling the smart contract', async () => {
//       await assertRevert(pumaPayPullPayment.executePullPayment(clientOne, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         }));
//     });
//
//     it('should emit a "LogPullPaymentExecuted" event', async () => {
//       await timeTravel(DAY);
//       const pullPaymentExecution = await pumaPayPullPayment.executePullPayment(
//         clientOne,
//         singlePullPayment.paymentID,
//         singlePullPayment.numberOfPayments,
//         {
//           from: paymentExecutorOne
//         });
//
//       const logs = pullPaymentExecution.logs;
//
//       assert.equal(logs.length, 1);
//       assert.equal(logs[ 0 ].event, 'LogPullPaymentExecuted');
//       logs[ 0 ].args.customerAddress.should.be.equal(singlePullPayment.client);
//       logs[ 0 ].args.paymentID.should.be.equal(singlePullPayment.paymentID);
//       logs[ 0 ].args.businessID.should.be.equal(singlePullPayment.businessID);
//       logs[ 0 ].args.uniqueReferenceID.should.be.equal(singlePullPayment.uniqueReferenceID);
//     });
//   });
//
//   describe('Execute Recurring Pull Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('add executors', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     beforeEach('approve PumaPay Pull Payment  to transfer from second client\'s account ', async () => {
//       await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
//         from: clientTwo
//       });
//     });
//
//     beforeEach('set recurring pull payment details', async () => {
//       const ethDate = await currentBlockTime();
//       recurringPullPayment.frequency = 1000000 * YEAR;
//       recurringPullPayment.startTimestamp = ethDate;
//     });
//
//     beforeEach('Add recurring pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(recurringPullPayment, CLIENT_TWO_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ recurringPullPayment.paymentID, recurringPullPayment.businessID ],
//         [ recurringPullPayment.client, recurringPullPayment.pullPaymentExecutorAddress, recurringPullPayment.treasuryAddress ],
//         recurringPullPayment.currency,
//         recurringPullPayment.uniqueReferenceID,
//         recurringPullPayment.initialPaymentAmountInCents,
//         recurringPullPayment.fiatAmountInCents,
//         recurringPullPayment.frequency,
//         recurringPullPayment.numberOfPayments,
//         recurringPullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//     });
//
//     it('should pull the amount specified on the payment details to the beneficiary', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
//       Number(beneficiaryBalance).should.be.equal(100 * ONE_ETHER);
//     });
//
//     it('should update the pull payment numberOfPayments', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, paymentExecutorTwo);
//
//       String(pullPayment[ 7 ]).should.be
//         .equal(String(web3.utils.toBN(recurringPullPayment.numberOfPayments - 1))); // NUMBER OF ALLOWED PULL PAYMENTS
//     });
//
//     it('should update the pull payment nextPaymentTimestamp', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, paymentExecutorTwo);
//       String(pullPayment[ 9 ]).should.be
//         .equal(String(web3.utils.toBN(recurringPullPayment.startTimestamp + recurringPullPayment.frequency))); // NEXT PAYMENT TS
//     });
//
//     it('should update the pull payment lastPaymentTimestamp', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       const ethDate = await currentBlockTime();
//       const pullPayment = await pumaPayPullPayment.pullPayments(clientTwo, paymentExecutorTwo);
//
//       String(pullPayment[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
//     });
//
//     it('should execute the next payment when next payment date is reached', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//       await timeTravel(1000000 * YEAR);
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 1, {
//         from: paymentExecutorTwo
//       });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
//       Number(beneficiaryBalance).should.be.equal(200 * ONE_ETHER);
//     });
//
//     it('should revert when if the next payment date is NOT reached', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       await timeTravel(1000000 * YEAR - DAY);
//       await assertRevert(pumaPayPullPayment.executePullPayment(
//         clientTwo,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.numberOfPayments,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//
//     it('should revert if the number of payments passed is less than the correct one', async () => {
//       await assertRevert(pumaPayPullPayment.executePullPayment(
//         clientTwo,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.numberOfPayments - 1,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//
//     it('should revert if the number of payments passed is more than the correct one', async () => {
//       await assertRevert(pumaPayPullPayment.executePullPayment(
//         clientTwo,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.numberOfPayments + 1,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//
//     it('should allow the merchant to pull payments in case they have missed few payments', async () => {
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//
//       await timeTravel(4000000 * YEAR); // 4 more payments are allowed!
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 1, {
//         from: paymentExecutorTwo
//       });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 2, {
//         from: paymentExecutorTwo
//       });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 3, {
//         from: paymentExecutorTwo
//       });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 4, {
//         from: paymentExecutorTwo
//       });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
//       Number(beneficiaryBalance).should.be.equal(500 * ONE_ETHER);
//       await assertRevert(pumaPayPullPayment.executePullPayment(
//         clientTwo,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.numberOfPayments - 1,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//
//     it('should allow the merchant to pull payments in case they have missed few payments and the customer cancelled the subscription', async () => {
//       await timeTravel(2000000 * YEAR + DAY); // 3 paymets are allowed!
//       const signature = await calcSignedMessageForDeletion(recurringPullPayment.paymentID, paymentExecutorTwo, CLIENT_TWO_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.client,
//         paymentExecutorTwo, {
//           from: executorOne
//         });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments, {
//         from: paymentExecutorTwo
//       });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 1, {
//         from: paymentExecutorTwo
//       });
//       await pumaPayPullPayment.executePullPayment(clientTwo, recurringPullPayment.paymentID, recurringPullPayment.numberOfPayments - 2, {
//         from: paymentExecutorTwo
//       });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.02 USD ==> 1 USD = 50 PMA ==> 2 USD = 100 PMA
//       Number(beneficiaryBalance).should.be.equal(300 * ONE_ETHER);
//       await assertRevert(pumaPayPullPayment.executePullPayment(
//         clientTwo,
//         recurringPullPayment.paymentID,
//         recurringPullPayment.numberOfPayments - 1,
//         {
//           from: paymentExecutorTwo
//         }));
//     });
//   });
//
//   describe('Execute Recurring Pull Payment with initial amount', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('add executors', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     beforeEach('approve PumaPay Pull Payment  to transfer from third client\'s account ', async () => {
//       await token.approve(pumaPayPullPayment.address, MINTED_TOKENS, {
//         from: clientThree
//       });
//     });
//
//     beforeEach('set recurring pull payment with initial amount details', async () => {
//       const ethDate = await currentBlockTime();
//       recurringPullPaymentWithInitialAmount.startTimestamp = ethDate + DAY;
//     });
//
//     beforeEach('Add recurring pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(recurringPullPaymentWithInitialAmount, CLIENT_THREE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ recurringPullPaymentWithInitialAmount.paymentID,
//           recurringPullPaymentWithInitialAmount.businessID ],
//         [ recurringPullPaymentWithInitialAmount.client,
//           recurringPullPaymentWithInitialAmount.pullPaymentExecutorAddress,
//           recurringPullPaymentWithInitialAmount.treasuryAddress ],
//         recurringPullPaymentWithInitialAmount.currency,
//         recurringPullPaymentWithInitialAmount.uniqueReferenceID,
//         recurringPullPaymentWithInitialAmount.initialPaymentAmountInCents,
//         recurringPullPaymentWithInitialAmount.fiatAmountInCents,
//         recurringPullPaymentWithInitialAmount.frequency,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         recurringPullPaymentWithInitialAmount.startTimestamp,
//         {
//           from: executorOne
//         });
//     });
//
//     it('should pull the initial amount specified on the payment details to the beneficiary', async () => {
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//
//       Number(beneficiaryBalance).should.be.equal(50 * ONE_ETHER);
//     });
//
//     it('should pull the amount of the first payment specified for the recurring payment to the beneficiary after receiving the initial payment', async () => {
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//
//       Number(beneficiaryBalance).should.be.equal(150 * ONE_ETHER);
//     });
//
//     it('should pull the amount of the second payment specified for the reccuring payment to the beneficiary', async () => {
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//       await timeTravel(DAY);
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//       await timeTravel(2 * DAY);
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments - 1,
//         {
//           from: paymentExecutorThree
//         });
//
//       const beneficiaryBalance = await token.balanceOf(treasuryAddress);
//
//       Number(beneficiaryBalance).should.be.equal(250 * ONE_ETHER);
//     });
//
//     it('should set the intial payment amount to ZERO after pulling it', async () => {
//       const pullPaymentBefore = await pumaPayPullPayment.pullPayments(clientThree, paymentExecutorThree);
//       String(pullPaymentBefore[ 4 ]).should.be
//         .equal(String(web3.utils.toBN(recurringPullPaymentWithInitialAmount.initialPaymentAmountInCents))); // INITIAL AMOUNT
//
//       await pumaPayPullPayment.executePullPayment(
//         clientThree,
//         recurringPullPaymentWithInitialAmount.paymentID,
//         recurringPullPaymentWithInitialAmount.numberOfPayments,
//         {
//           from: paymentExecutorThree
//         });
//       const pullPaymentAfter = await pumaPayPullPayment.pullPayments(clientThree, paymentExecutorThree);
//       const ethDate = await currentBlockTime();
//
//       String(pullPaymentAfter[ 4 ]).should.be.equal(String(web3.utils.toBN(0))); // INITIAL AMOUNT
//       String(pullPaymentAfter[ 10 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // LAST PAYMENT TIMESTAMP
//     });
//   });
// });
//
// contract('PumaPay Pull Payment Contract For Funding', async (accounts) => {
//   const deployerAccount = accounts[ 0 ];
//   const owner = accounts[ 1 ];
//   const executorOne = accounts[ 2 ];
//   const facilitatorOne = accounts[ 4 ];
//   const clientOne = accounts[ 7 ];
//   const clientTwo = accounts[ 8 ];
//   const clientThree = accounts[ 9 ];
//   const treasuryAddress = accounts[ 10 ];
//
//   const gasPrice = 1000000000;
//
//   let singlePullPayment = {
//     paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
//     businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
//     uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_1'), 64),
//     client: clientOne,
//     pullPaymentExecutorAddress: facilitatorOne,
//     currency: 'EUR',
//     initialPaymentAmountInCents: 0,
//     fiatAmountInCents: 100000000, // 1 million in EUR cents
//     frequency: 1,
//     numberOfPayments: 1,
//     startTimestamp: Math.floor(Date.now() / 1000) + DAY,
//     treasuryAddress: treasuryAddress
//   };
//
//   let token;
//   let pumaPayPullPayment;
//
//   beforeEach('Deploying new PumaPayToken', async () => {
//     token = await PumaPayToken.new({
//       from: deployerAccount
//     });
//   });
//
//   beforeEach('Deploying new PumaPay Pull Payment', async () => {
//     pumaPayPullPayment = await PumaPayPullPayment
//       .new(token.address, {
//         from: owner
//       });
//   });
//
//   beforeEach('Issue tokens to the clients', async () => {
//     const tokens = MINTED_TOKENS;
//     await token.mint(clientOne, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientTwo, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientThree, tokens, {
//       from: deployerAccount
//     });
//   });
//
//   const transferEthersToSmartContract = async (ethers, fromAccount, smartContract) => {
//     await smartContract.sendTransaction(
//       {
//         from: fromAccount,
//         value: ethers * ONE_ETHER
//       }
//     );
//   };
//
//   describe('Set Rate', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(1, deployerAccount, pumaPayPullPayment);
//     });
//     afterEach('Transfer ETH to owner account', async () => {
//       await web3.eth.sendTransaction({
//         from: deployerAccount,
//         to: owner,
//         value: 5 * ONE_ETHER
//       });
//     });
//     it('should transfer ETH to the owner when its balance is lower than 0.15 ETH and set the rate', async () => {
//       const ownerBalance = await web3.eth.getBalance(owner);
//       const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
//
//       await web3.eth.sendTransaction({
//         from: owner,
//         to: deployerAccount,
//         value: web3.utils.toWei(String(ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
//       });
//
//       const ownerBalanceBefore = await web3.eth.getBalance(owner);
//       const transaction = await pumaPayPullPayment.setRate('EUR', EUR_EXCHANGE_RATE, {
//         from: owner
//       });
//       const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
//       const ownerBalanceAfter = await web3.eth.getBalance(owner);
//       const euroRate = await pumaPayPullPayment.getRate('EUR');
//       const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
//
//       String(euroRate).should.be.equal(String(web3.utils.toBN(EUR_EXCHANGE_RATE)));
//       assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//
//     });
//   });
//
//   describe('Add Executor', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
//     });
//     afterEach('Transfer ETH to owner account', async () => {
//       await web3.eth.sendTransaction({
//         from: deployerAccount,
//         to: owner,
//         value: 5 * ONE_ETHER
//       });
//     });
//
//     it('should transfer ETH to the owner when its balance is lower than 0.15 ETH', async () => {
//       const ownerBalance = await web3.eth.getBalance(owner);
//       const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
//
//       await web3.eth.sendTransaction({
//         from: owner,
//         to: deployerAccount,
//         value: web3.utils.toWei(String(ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
//       });
//
//       const ownerBalanceBefore = await web3.eth.getBalance(owner);
//       const transaction = await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//       const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
//
//       const ownerBalanceAfter = await web3.eth.getBalance(owner);
//       const executor = await pumaPayPullPayment.executors(executorOne);
//
//       const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
//
//       assert.equal(executor, true);
//       assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//     });
//   });
//
//   describe('Remove Executor', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(2, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('Add executor ETH to smart contract', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     afterEach('Transfer ETH to owner account', async () => {
//       await web3.eth.sendTransaction({
//         from: deployerAccount,
//         to: owner,
//         value: 5 * ONE_ETHER
//       });
//     });
//
//     it('should transfer ETH to the owner when its balance is lower than 0.15 ETH', async () => {
//       const ownerBalance = await web3.eth.getBalance(owner);
//       const ownerBalanceETH = web3.utils.fromWei(String(ownerBalance), 'ether');
//
//       await web3.eth.sendTransaction({
//         from: owner,
//         to: deployerAccount,
//         value: web3.utils.toWei(String(ownerBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
//       });
//
//       const ownerBalanceBefore = await web3.eth.getBalance(owner);
//       const transaction = await pumaPayPullPayment.removeExecutor(executorOne, {
//         from: owner
//       });
//       const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
//
//       const ownerBalanceAfter = await web3.eth.getBalance(owner);
//       const executor = await pumaPayPullPayment.executors(executorOne);
//       const expectedBalance = web3.utils.toBN(ownerBalanceAfter).sub(web3.utils.toBN(ownerBalanceBefore)).add(web3.utils.toBN(txFee));
//
//       assert.equal(executor, false);
//       assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//     });
//   });
//
//   describe('Register Pull Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(3, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('Add executor ETH to smart contract', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     afterEach('Transfer ETH to owner account', async () => {
//       await web3.eth.sendTransaction({
//         from: deployerAccount,
//         to: executorOne,
//         value: 5 * ONE_ETHER
//       });
//     });
//
//     it('should transfer ETH to the executor when its balance is lower than 0.15 ETH and register a pull payment', async () => {
//       const executorBalance = await web3.eth.getBalance(executorOne);
//       const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
//       await web3.eth.sendTransaction({
//         from: executorOne,
//         to: deployerAccount,
//         value: web3.utils.toWei(String(executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
//       });
//
//       const executorBalanceBefore = await web3.eth.getBalance(executorOne);
//
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       const transaction = await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//
//       const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
//       const executorBalanceAfter = await web3.eth.getBalance(executorOne);
//       const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);
//
//       const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));
//
//       assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//
//       activePaymentInArray[ 0 ].should.be.equal(singlePullPayment.paymentID); // PAYMENT ID
//       activePaymentInArray[ 1 ].should.be.equal(singlePullPayment.businessID); // BUSINESS ID
//       activePaymentInArray[ 2 ].should.be.equal(singlePullPayment.uniqueReferenceID); // UNIQUE REFERENCE ID
//       activePaymentInArray[ 3 ].should.be.equal(singlePullPayment.currency); // CURRENCY
//       String(activePaymentInArray[ 4 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.initialPaymentAmountInCents))); // INITIAL AMOUNT
//       String(activePaymentInArray[ 5 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.fiatAmountInCents))); // FIAT AMOUNT
//       String(activePaymentInArray[ 6 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.frequency))); // FREQUENCY
//       String(activePaymentInArray[ 7 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.numberOfPayments))); // NUMBER OF ALLOWED PULL PAYMENTS
//       String(activePaymentInArray[ 8 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp))); // START TIMESTAMP
//       String(activePaymentInArray[ 9 ]).should.be
//         .equal(String(web3.utils.toBN(singlePullPayment.startTimestamp))); // NEXT PAYMENT TIMESTAMP = START TIMESTAMP
//       String(activePaymentInArray[ 10 ]).should.be.equal(String(web3.utils.toBN(0))); // LAST PAYMENT TIMESTAMP
//       String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(0))); // CANCEL PAYMENT TIMESTAMP
//       activePaymentInArray[ 12 ].should.be.equal(treasuryAddress); // TREASURY ADDRESS
//     });
//   });
//
//   describe('Delete Pull Payment', async () => {
//     beforeEach('Transfer ETH to smart contract', async () => {
//       await transferEthersToSmartContract(3, deployerAccount, pumaPayPullPayment);
//     });
//     beforeEach('Add executor ETH to smart contract', async () => {
//       await pumaPayPullPayment.addExecutor(executorOne, {
//         from: owner
//       });
//     });
//     beforeEach('Add single pull payment', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//     });
//     afterEach('Transfer ETH to owner account', async () => {
//       await web3.eth.sendTransaction({
//         from: deployerAccount,
//         to: executorOne,
//         value: 5 * ONE_ETHER
//       });
//     });
//
//     it('should transfer ETH to the executor when its balance is lower than 0.15 ETH', async () => {
//       const executorBalance = await web3.eth.getBalance(executorOne);
//       const executorBalanceETH = web3.utils.fromWei(String(executorBalance), 'ether');
//       await web3.eth.sendTransaction({
//         from: executorOne,
//         to: deployerAccount,
//         value: web3.utils.toWei(String(executorBalanceETH - MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS))
//       });
//
//       const executorBalanceBefore = await web3.eth.getBalance(executorOne);
//       const signature = await calcSignedMessageForDeletion(singlePullPayment.paymentID, singlePullPayment.pullPaymentExecutorAddress, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       const transaction = await pumaPayPullPayment.deletePullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         singlePullPayment.paymentID,
//         singlePullPayment.client,
//         singlePullPayment.pullPaymentExecutorAddress, {
//           from: executorOne
//         });
//
//       const txFee = Number(transaction.receipt.gasUsed) * gasPrice;
//       const executorBalanceAfter = await web3.eth.getBalance(executorOne);
//       const ethDate = await currentBlockTime();
//
//       const activePaymentInArray = await pumaPayPullPayment.pullPayments(clientOne, facilitatorOne);
//
//       const expectedBalance = web3.utils.toBN(executorBalanceAfter).sub(web3.utils.toBN(executorBalanceBefore)).add(web3.utils.toBN(txFee));
//
//       assert.equal(web3.utils.fromWei(String(expectedBalance), 'ether'), web3.utils.fromWei(String(FUNDING_AMOUNT), 'ether'));
//       String(activePaymentInArray[ 11 ]).should.be.equal(String(web3.utils.toBN(ethDate))); // CANCEL PAYMENT TS
//     });
//   });
// });
//
// contract('PumaPay Pull Payment Contract For Overflow / Underflow checks', async (accounts) => {
//   const deployerAccount = accounts[ 0 ];
//   const owner = accounts[ 1 ];
//   const executorOne = accounts[ 2 ];
//   const facilitatorOne = accounts[ 4 ];
//   const clientOne = accounts[ 7 ];
//   const clientTwo = accounts[ 8 ];
//   const clientThree = accounts[ 9 ];
//   const treasuryAddress = accounts[ 10 ];
//
//   const gasPrice = 1000000000;
//
//   let singlePullPayment = {
//     paymentID: web3.utils.padRight(web3.utils.fromAscii('paymentID_1'), 64),
//     businessID: web3.utils.padRight(web3.utils.fromAscii('businessID_1'), 64),
//     uniqueReferenceID: web3.utils.padRight(web3.utils.fromAscii('uniqueReferenceID_1'), 64),
//     client: clientOne,
//     pullPaymentExecutorAddress: facilitatorOne,
//     currency: 'EUR',
//     initialPaymentAmountInCents: 0,
//     fiatAmountInCents: 100000000000, // 1 billion in EUR cents
//     frequency: 1,
//     numberOfPayments: 1,
//     startTimestamp: Math.floor(Date.now() / 1000) + DAY,
//     treasuryAddress: treasuryAddress
//   };
//
//   let token;
//   let pumaPayPullPayment;
//
//   beforeEach('Deploying new PumaPayToken', async () => {
//     token = await PumaPayToken.new({
//       from: deployerAccount
//     });
//   });
//
//   beforeEach('Deploying new PumaPay Pull Payment', async () => {
//     pumaPayPullPayment = await PumaPayPullPayment
//       .new(token.address, {
//         from: owner
//       });
//   });
//
//   beforeEach('Issue tokens to the clients', async () => {
//     const tokens = MINTED_TOKENS;
//     await token.mint(clientOne, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientTwo, tokens, {
//       from: deployerAccount
//     });
//     await token.mint(clientThree, tokens, {
//       from: deployerAccount
//     });
//   });
//
//   beforeEach('Transfer ETH to smart contract', async () => {
//     await transferEthersToSmartContract(3, deployerAccount, pumaPayPullPayment);
//   });
//
//   beforeEach('Add executor ETH to smart contract', async () => {
//     await pumaPayPullPayment.addExecutor(executorOne, {
//       from: owner
//     });
//   });
//
//   describe('Overflow checks for setting the rate', async () => {
//     it('should update the rate with a very high number // 1 PMA = 1 Trillion FIAT', async () => {
//       const rate = DECIMAL_FIXER + '0000000000'; // 1 PMA = 1 Trillion EUR // 10^20
//       await pumaPayPullPayment.setRate('EUR', rate, {
//         from: owner
//       });
//
//       const contractRate = await pumaPayPullPayment.getRate('EUR');
//
//       String(contractRate).should.be.equal(String(web3.utils.toBN(rate)));
//     });
//   });
//
//   describe('Overflow checks for pull payment execution', async () => {
//     beforeEach('update the rate for a very high number', async () => {
//       const rate = DECIMAL_FIXER + '00000'; // 1 PMA = 100k EUR // 10^15
//       await pumaPayPullPayment.setRate('EUR', rate, {
//         from: owner
//       });
//     });
//
//     beforeEach('Approve pull payment smart contract with 90 Billion Billions of PMA', async () => {
//       await token.approve(pumaPayPullPayment.address, web3.utils.toWei(( MINTED_TOKENS + '000000000000000000' )), {
//         from: clientOne
//       });
//     });
//
//     it('should execute a pull payment of 1 BILLION FIAT with a conversion rate of 1 PMA = 100k EUR', async () => {
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//
//       await timeTravel(DAY + 1);
//       await pumaPayPullPayment.executePullPayment(singlePullPayment.client, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: facilitatorOne
//         });
//       const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 100k EUR ==> 1 Billion EUR = 10000 PMA
//       Number(balanceOfTreasuryAfter.toString()).should.be.equal(10000 * ONE_ETHER);
//     });
//
//     it('should execute a pull payment of 100k FIAT with a conversion rate of 1 PMA = 0.000001 FIAT', async () => {
//       singlePullPayment.fiatAmountInCents = 10000000; // 100k FIAT in cents
//       const signature = await calcSignedMessageForRegistration(singlePullPayment, CLIENT_ONE_PRIVATE_KEY);
//       const sigVRS = await getVRS(signature);
//
//       await pumaPayPullPayment.registerPullPayment(
//         sigVRS.v,
//         sigVRS.r,
//         sigVRS.s,
//         [ singlePullPayment.paymentID, singlePullPayment.businessID ],
//         [ singlePullPayment.client, singlePullPayment.pullPaymentExecutorAddress, singlePullPayment.treasuryAddress ],
//         singlePullPayment.currency,
//         singlePullPayment.uniqueReferenceID,
//         singlePullPayment.initialPaymentAmountInCents,
//         singlePullPayment.fiatAmountInCents,
//         singlePullPayment.frequency,
//         singlePullPayment.numberOfPayments,
//         singlePullPayment.startTimestamp,
//         {
//           from: executorOne
//         });
//
//       const rate = '100000'; // 1 PMA = 0.00001 FIAT // 0.00001 * DECIMAL_FIXER
//       await pumaPayPullPayment.setRate('EUR', rate, {
//         from: owner
//       });
//
//       await timeTravel(DAY + 1);
//       await pumaPayPullPayment.executePullPayment(singlePullPayment.client, singlePullPayment.paymentID, singlePullPayment.numberOfPayments,
//         {
//           from: facilitatorOne
//         });
//       const balanceOfTreasuryAfter = await token.balanceOf(treasuryAddress);
//       // 1 PMA = 0.00001 EUR ==> 1 EUR = 100000 PMA ==> 100k EUR = 10000000000 PMA
//       Number(balanceOfTreasuryAfter.toString()).should.be.equal(10000000000 * ONE_ETHER);
//     });
//   });
// });
