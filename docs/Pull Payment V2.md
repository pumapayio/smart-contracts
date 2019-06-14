# PumaPay Pull Payment V1
*Solidity Version: v0.5.8*

### Contract constructor
Sets the token address that the contract facilitates.
```solidity
constructor (IERC20 _token)
```
#### Payable
Allows the `PumaPayPullPayment` contract to receive and hold ETH to facilitate the funding of owner/executors.
```solidity
function () external payable
```
### Members
#### Owner
Our `PumaPayPullPayment` contract is `PayableOwnable`. 
```solidity
contract PumaPayPullPayment is PayableOwnable
```
*Note: PayableOwnable is an extension of the Ownable smart contract where the owner is also a payable address allowing the owner to receive ETH from the smart contract.* 
The owner (only one) of the smart contract is responsible for:
1. Add executors `function addExecutor(address _executor)`
2. Remove executor `function removeExecutor(address _executor)`  
On each function related with setting the rate or adding/removing executors the balance of the owner is checked and if the balance is lower than 0.01 ETH then 1 more ETH are sent to the owner address in order to pay for the gas fees related with those transactions.  
The owner is an address owned by the association governing the smart contract.
```solidity
if (isFundingNeeded(owner)) {
    owner.transfer(1 ether);
}
```
##### Executors
The `PumaPayPullPayment` contract can have multiple executors. Each executor is allowed to register or cancel a pull payment on behalf of a customer. The curstomer should sign the pull payment details using `keccak256` through the wallet and on registration/cancellation the signature parameters `(v, r, s)` of the signed pull payment are used to verify that the customer address was indeed the one which requested the registration/cancellation. Similarily to the owner, on registration/cancellation function the balance of the executor is checked and if is lower than 0.01 ETH 1 more ETH is sent from the smart contract to the executor to allow for registration/cancellation of pull payments.  
The executor(s) is an address owned by the association governing the smart contract.
```solidity
mapping (address => bool) public executors;
```
##### PullPayment
The `PumaPayPullPayment` contract consists of a for the `PullPayments`. 
The first address is the customer address and the second one is the merchant address.
```solidity
mapping (address => mapping (address => PullPayment)) public pullPayments;
```
The `PullPayment` struct is the following:
```solidity
struct PullPayment {
    bytes32 paymentID;                      /// ID of the payment
    bytes32 businessID;                     /// ID of the business
    string uniqueReferenceID;               /// unique reference ID the business is adding on the pull payment
    string currency;                        /// 3-letter abbr i.e. 'EUR' / 'USD' etc.
    uint256 initialPaymentAmountInCents;    /// initial payment amount in fiat in cents
    uint256 fiatAmountInCents;              /// payment amount in fiat in cents
    uint256 frequency;                      /// how often merchant can pull - in seconds
    uint256 numberOfPayments;               /// amount of pull payments merchant can make
    uint256 startTimestamp;                 /// when subscription starts - in seconds
    uint256 nextPaymentTimestamp;           /// timestamp of next payment
    uint256 lastPaymentTimestamp;           /// timestamp of last payment
    uint256 cancelTimestamp;                /// timestamp the payment was cancelled
    address treasuryAddress;                /// address which pma tokens will be transfer to on execution
}
```
#### Constants
```solidity
uint256 constant private DECIMAL_FIXER = 10 ** 10; /// 1e^10 - This transforms the Rate from decimals to uint256
uint256 constant private FIAT_TO_CENT_FIXER = 100;    /// Fiat currencies have 100 cents in 1 basic monetary unit.
uint256 constant private OVERFLOW_LIMITER_NUMBER = 10 ** 20; /// 1e^20 - Prevent numeric overflows

uint256 constant private ONE_ETHER = 1 ether;         /// PumaPay token has 18 decimals - same as one ETHER
uint256 constant private FUNDING_AMOUNT = 1 ether;  /// Amount to transfer to owner/executor
uint256 constant private MINIMUM_AMOUNT_OF_ETH_FOR_OPERATORS = 0.15 ether; /// min amount of ETH for owner/executor

bytes32 constant private TYPE_SINGLE_PULL_PAYMENT = "2";
bytes32 constant private TYPE_RECURRING_PULL_PAYMENT = "3";
bytes32 constant private TYPE_RECURRING_PULL_PAYMENT_WITH_INITIAL = "4";
bytes32 constant private TYPE_PULL_PAYMENT_WITH_FREE_TRIAL = "5";
bytes32 constant private TYPE_PULL_PAYMENT_WITH_PAID_TRIAL = "6";
bytes32 constant private TYPE_SINGLE_DYNAMIC_PULL_PAYMENT = "7";
```
#### Public Functions - Owner
##### addExecutor()
Adds an existing executor. It can be executed only by the owner.
The balance of the owner is checked and if funding is needed 1 ETH is transferred.
```solidity
function addExecutor(address payable _executor)
public
onlyOwner
isValidAddress(_executor)
executorDoesNotExists(_executor)
```
##### removeExecutor()
Removes an existing executor. It can be executed only by the owner.  
The balance of the owner is checked and if funding is needed 1 ETH is transferred.
```solidity
function removeExecutor(address payable _executor)
public
onlyOwner
isValidAddress(_executor)
executorExists(_executor)
```

#### Public Functions - Executor
##### registerPullPayment()
Registers a new pull payment to the PumaPay Pull Payment Contract. The registration can be executed only by one of the `executors` of the PumaPay Pull Payment Contract and the PumaPay Pull Payment Contract checks that the pull payment has been singed by the client of the account.
On pull payment registration, the first execution of the pull payment happens as well i.e. transfer of PMA from the customer to the business treasury wallet. This will happen based on the pull payment type. 
The balance of the executor (msg.sender) is checked and if funding is needed 1 ETH is transferred.
```solidity
function registerPullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32[4] memory _paymentDetails, // 0 paymentID, 1 businessID, 2 uniqueReferenceID, 3 paymentType
    address[3] memory _addresses, // 0 customer, 1 pull payment executor, 2 treasury
    uint256[3] memory _paymentAmounts, // 0 _initialConversionRate, 1 _fiatAmountInCents, 2 _initialPaymentAmountInCents
    uint256[4] memory _paymentTimestamps, // 0 _frequency, 1 _numberOfPayments, 2 _startTimestamp, 3 _trialPeriod
    string memory _currency
)
public
isExecutor()
isValidPaymentType(_paymentDetails[3])
```
##### deletePullPayment()
Deletes a pull payment for a beneficiary. The deletion needs can be executed only by one of the `executors` of the PumaPay Pull Payment Contract and the PumaPay Pull Payment Contract checks that the beneficiary and the paymentID have been singed by the client of the account. This method sets the cancellation of the pull payment in the pull payments array for this beneficiary specified.
The balance of the executor (msg.sender) is checked and if funding is needed, 1 ETH is transferred.
```solidity
function deletePullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32 _paymentID,
    address _customerAddress,
    address _pullPaymentExecutor
)
public
isExecutor()
paymentExists(_customerAddress, _pullPaymentExecutor)
paymentNotCancelled(_customerAddress, _pullPaymentExecutor)
isValidDeletionRequest(_paymentID, _customerAddress, _pullPaymentExecutor)
```

#### Public Functions
##### executePullPayment()
```solidity
function executePullPayment(address _customerAddress, bytes32 _paymentID, uint256 _conversionRate)
public
paymentExists(_customerAddress, msg.sender)
isValidPullPaymentExecutionRequest(_customerAddress, msg.sender, _paymentID)
validAmount(_conversionRate)
returns (bool)
```
Executes a pull payment for the address that is calling the function `msg.sender`. The pull payment should exist and the payment request should be valid in terms of when it can be executed.
The execution of the pull payment will transfer PMA from the customer wallet to the business treasury wallet. 

#### Internal Functions
##### isValidRegistration()
Checks if a registration request is valid by comparing the `v, r, s` params and the hashed params with the client. address. 
```solidity
function isValidRegistration(
    uint8 v,
    bytes32 r,
    bytes32 s,
    address _customerAddress,
    address _pullPaymentExecutor,
    PullPayment memory _pullPayment
)
internal
pure
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _pullPaymentExecutor,
                _pullPayment.paymentIds[0],
                _pullPayment.paymentType,
                _pullPayment.treasuryAddress,
                _pullPayment.currency,
                _pullPayment.initialPaymentAmountInCents,
                _pullPayment.fiatAmountInCents,
                _pullPayment.frequency,
                _pullPayment.numberOfPayments,
                _pullPayment.startTimestamp,
                _pullPayment.trialPeriod
            )
        ),
        v, r, s) == _customerAddress;
}
```   
More about recovery ID of an ETH signature and ECDSA signatures can be found [here](https://github.com/ethereum/EIPs/issues/155).
##### isValidDeletion()
Checks if a deletion request is valid by comparing the `v, r, s` params and the hashed params with the client. address and the `paymentID` itself as well. The hashed parameters is the `paymentID` and the `beneficiary` (merchant) address.
```solidity
function isValidDeletion(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32 _paymentID,
    address _customerAddress,
    address _pullPaymentExecutor
)
internal
view
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _paymentID,
                _pullPaymentExecutor
            )
        ), v, r, s) == _customerAddress
    && keccak256(
        abi.encodePacked(pullPayments[_customerAddress][_pullPaymentExecutor].paymentIds[0])
    ) == keccak256(abi.encodePacked(_paymentID)
    );
}
``` 
##### calculatePMAFromFiat()
Calculates the PMA Rate for the fiat currency specified. The rate is set every 10 minutes by our PMA server for the currencies specified in the smart contract. Two helpers/fixers are used for this calculation:
1. `ONE_ETHER` - One ETH in wei
2. `DECIMAL_FIXER` - Transforms the Rate from `decimals` to `uint256` and is the same value that is being used for setting the rate
3. `FIAT_TO_CENT_FIXER` - The payment amounts that are being used in the smart contract are noted in CENTS since `decimals` are not supported in `solidity` yet.
Calculation: 
```solidity
function calculatePMAFromFiat(uint256 _fiatAmountInCents, uint256 _conversionRate)
internal
pure
validAmount(_fiatAmountInCents)
validAmount(_conversionRate)
returns (uint256) {
    return ONE_ETHER.mul(DECIMAL_FIXER).mul(_fiatAmountInCents).div(_conversionRate).div(FIAT_TO_CENT_FIXER);
}
```
##### doesPaymentExist()
Checks if a payment for a pull payment executor of a client exists.
##### isFundingNeeded()
Checks if the address of the `owner` or an `executor` needs to be funded. 
The minimum amount the owner/executors should always have is 0.01 ETH 

#### Events
```solidity
event LogExecutorAdded(address executor);   // When adding a new executor
event LogExecutorRemoved(address executor); // When removing an existing executor

// When registering a new pull payment
event LogPaymentRegistered(
    address customerAddress,
    bytes32 paymentID,
    bytes32 businessID,
    bytes32 uniqueReferenceID
);

// When removing a new pull payment
event LogPaymentCancelled(
    address customerAddress,
    bytes32 paymentID,
    bytes32 businessID,
    bytes32 uniqueReferenceID
);

// When executing a pull payment
event LogPullPaymentExecuted(
    address customerAddress,
    bytes32 paymentID,
    bytes32 businessID,
    bytes32 uniqueReferenceID,
    uint256 amountInPMA,
    uint256 conversionRate
);
```