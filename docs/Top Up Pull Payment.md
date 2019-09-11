# Top Up Pull Payment 

### Use Case
A business that allows their customers to purchase various items or services using Credits. 

The business allows their customers to subscribe to a top up billing model. The top-up billing model works as follows:
1. The customer can purchase 100 Credits from the business for 10$.
2. The customer can then start spending the 100 Credits using different services or through purchasing different items from the business.
3. When the customer's Credits drops to 25 credits, the business is allowed to charge 7.50$ for 75 Credits, therefore 'topping up' to 100 Credits again.
4. The customer is allowed to specify different limits when it comes to the top up pull payment such as:
    1. Total Limits - ***example:*** *100$ in total*
    2. Time-based limits - ***example:*** *20$ per day*
    3. Expiration time  - ***example:*** *expires on 31/12/2019*
    4. Combination of the above - ***example:*** *100$ in total & 20$ per day & expires on 31/12/2019*

#### Total Limits
The customer is allowed to specify how much (s)he is willing to spend in total.   
***Example:***
The customer subscribed to a top up billing model which will charge him 10$ for purchasing 100 Credits.   
The customer spends 75 Credits and the business can automatically charge the customer $7.50 to top up the 75 Credits.  

The customer specifies that the maximum amount that (s)he is willing to spend in total in this top up billing model is 100$.  

This means that the business can trigger the top up payment and pull PMA from the customer account only up until 100$ in PMA.
The customer can increase/decrease the top up limit at any point.

#### Time-Based Limits
The customer is allowed to specify how much (s)he is willing to spend in total for a specific time period.   
***Example:***
The customer subscribed to a top up billing model which will charge him 10$ for purchasing 100 Credits.   
The customer spends 75 Credits and the business can charge the customer $7.50 for topping up to 75 Credits.  

The customer specifies that the maximum amount that (s)he is willing to spend in total in this top up billing model is 100$, 
and that the maximum amount that he is willing to spend daily (time-based limit) is 20$. 

This means that the business can trigger the top up payment and pull PMA from the customer account only up until 100$ in PMA.
The time-based limit restricts the business to pull from the customer account only up until 20$ per day in PMA.   
The customer can increase/decrease the top up total and time-based limit at any point.  

#### Expiration Time
The customer is allowed to specify how much (s)he is willing to spend in total and until a specific date.   
***Example:***
The customer subscribed to a top up billing model which will charge him 10$ for purchasing 100 Credits.   
If the customer spends 75 Credits the business can then automatically charge the customer $7.50 to top up his wallet to 100 credits.  

The customer specifies that the maximum amount that (s)he is willing to spend in total in this top up billing model is 100$, 
and that the top up payment is only valid until 31/12/2019 (expiration time). 

This means that the business can trigger the top up payment and pull PMA from the customer account up until 100$ in PMA.
In addition, the business is only allowed to trigger the top up pull payments only until the expiration time of i.e. 31/12/2019.    
The customer can increase/decrease the top up total and update the expiration date whenever they choose.

####  Combination of the above - Total Limits & Time-Based limits & Expiration Time
The customer is allowed to specify how much (s)he is willing to spend in total, for a specific time period and until a specific date.
***Example:***
The customer subscribed to a top up billing model which will charge him 10$ for purchasing 100 Credits.   
If the customer spends 75 Credits the business can then automatically charge the customer $7.50 to top up his wallet to 100 credits.

The customer specifies that the maximum amount that (s)he is willing to spend in total in this top up billing model is 100$,
the maximum amount that he is willing to spend daily (time-based limit) is 20$ 
and that the top up payment is valid only until 31/12/2019 (expiration time). 

This means that the business can trigger the top up payment and pull PMA from the customer account only up until 100$ in PMA.
The time-based limit, restricts the business to pull from the customer account only up until 20$ per day in PMA.
In addition, the business is allowed to trigger the top up pull payments only until the expiration date i.e. 31/12/2019.    
The customer can increase/decrease the top up total and update the expiration date.


## Implementation
We have developed 4 different smart contracts, one for each use case that we have:
1. [`TopUpPullPayment.sol`](../contracts/topUp/TopUpPullPayment.sol)
2. [`TopUpTimeBasedPullPayment.sol`](../contracts/topUp/TopUpTimeBasedPullPayment.sol)
3. [`TopUpPullPaymentWithExpiration.sol`](../contracts/topUp/TopUpPullPaymentWithExpiration.sol)
4. [`TopUpTimeBasedPullPaymentWithExpiration.sol`](../contracts/topUp/TopUpTimeBasedPullPaymentWithExpiration.sol)

**The main logic is the same for each smart contract:**
  
When the customer subscribes to a top up billing model, (s)he is setting the top up billing model parameters (see below for more details).
On the smart contract we validate that the registration came from the customer and store the top up pull payment. The smart contract then executes the first payment. Following successful registration and first payment, the business is then notified of the payment and it gives the customer access to the service (s)he has purchased.

The customer can then continue to use the service provided by the business and once the 'credits' balance of the customer drops below the predefined amount, the business can then trigger a top up through our PumaPay APIs to execute the top up.

We monitor the smart contracts to ensure they meet the set of parameters
i.e. is within the limits (total/time-based/expiration time), if the parameters are met, the pull payment is executed transferring PMA from the customer to the business' treasury wallet. The PumaPay ecosystem
notifies the business of the successful pull payment and they can update the 'credits' in the customer's account. 
If the payment is not allowed to happen, i.e. the limits have been reached, the customer is notified in their wallet and asks the customers to update the limits.

## Smart Contracts
*Solidity Version: v0.5.11*

#### Contract constructor
Sets the token address that the contract facilitates.
```solidity
constructor (IERC20 _token)
```

#### Payable
Allows the `TopUpPullPayment` contract to receive and hold ETH to facilitate the funding of owner/executors.
```solidity
function () external payable
```

#### Owner
Our `TopUpPullPayment` contract is `PayableOwnable`. 
```solidity
contract TopUpPullPayment is PayableOwnable
```
*Note: PayableOwnable is an extension of the Ownable smart contract where the owner is also a payable address allowing the owner to receive ETH from the smart contract.* 
The owner (only one) of the smart contract is responsible for:
1. Add executors `function addExecutor(address _executor)`
2. Remove executor `function removeExecutor(address _executor)`  
On each function related with setting the rate or adding/removing executors, the balance of the owner is checked and if the balance is lower than 0.01 ETH then 1 more ETH is sent to the ownerÕs address in order to pay for the gas fees related with those transactions.  
The owner is an address owned by the association governing the smart contract.
```solidity
uint256 constant internal FUNDING_AMOUNT = 0.5 ether;

if (isFundingNeeded(owner)) {
    owner.transfer(FUNDING_AMOUNT ether);
}
```

#### Executors
The `TopUpPullPayment` contract can have multiple executors. Each executor is allowed to register or cancel a pull payment on behalf of a customer. The curstomer should sign the pull payment details using `keccak256` through the wallet and on registration/cancellation the signature parameters `(v, r, s)` of the signed pull payment are used to verify that the customer address was indeed the one which requested the registration/cancellation. Similarly to the owner, on registration/cancellation function the balance of the executor is checked and if it is lower than 0.01 ETH 1 more ETH is sent from the smart contract to the executor to allow for registration/cancellation of pull payments.  
The executor(s) is an address owned by the association governing the smart contract.
```solidity
mapping (address => bool) public executors;
```

#### Top Up PullPayment
The `TopUpPullPayment` contract consists of a mapping for the `TopUpPayment`. 
The mapping consists of the `paymentID` as `bytes32` and the `TopUpPayment`.
In the case of the time based limits, we have another mapping of the `paymentID` as `bytes32` to the `TimeBasedLimits`.
```solidity
mapping(bytes32 => TopUpPayment) public pullPayments;
/// For time based limits we have also
mapping(bytes32 => TimeBasedLimits) public timeBasedLimits;
```

#### TopUpPayment Struct 
- - -
***Total Limits***
```solidity
struct TopUpPayment {
    bytes32[2] paymentIDs;                  /// [0] paymentID / [1] businessID
    string currency;                        /// 3-letter abbr i.e. 'EUR' / 'USD' etc.
    address customerAddress;                /// wallet address of customer
    address treasuryAddress;                /// address which pma tokens will be transfer to on execution
    address executorAddress;                /// address that can execute the pull payment
    uint256 initialConversionRate;          /// conversion rate for first payment execution
    uint256 initialPaymentAmountInCents;    /// initial payment amount in fiat in cents
    uint256 topUpAmountInCents;             /// payment amount in fiat in cents
    uint256 startTimestamp;                 /// when subscription starts - in seconds
    uint256 lastPaymentTimestamp;           /// timestamp of last payment
    uint256 cancelTimestamp;                /// timestamp the payment was cancelled
    uint256 totalLimit;                     /// total limit that the customer is willing to pay
    uint256 totalSpent;                     /// total amount spent by the customer
}
```
- - -
***Total Limits & Time Based limits***
The `TopUpPayment` struct remains the same as above and we have added the `TimeBasedLimits` struct which stores all the details of the time based limitations
set by the customer.
```solidity
struct TimeBasedLimits {
    uint256 limit;                     /// time based limit that the customer is willing to pay
    uint256 spent;                     /// time based amount spent by the customer
    uint256 period;                    /// time based period set by the customer
    uint256 setTimestamp;              /// time based limit set timestamp
}
```
- - -
***Total Limits & Expiration Time***
```solidity
struct TopUpPayment {
    bytes32[2] paymentIDs;                  /// [0] paymentID / [1] businessID
    string currency;                        /// 3-letter abbr i.e. 'EUR' / 'USD' etc.
    address customerAddress;                /// wallet address of customer
    address treasuryAddress;                /// address which pma tokens will be transfer to on execution
    address executorAddress;                /// address that can execute the pull payment
    uint256 initialConversionRate;          /// conversion rate for first payment execution
    uint256 initialPaymentAmountInCents;    /// initial payment amount in fiat in cents
    uint256 topUpAmountInCents;             /// payment amount in fiat in cents
    uint256 startTimestamp;                 /// when subscription starts - in seconds
    uint256 lastPaymentTimestamp;           /// timestamp of last payment
    uint256 cancelTimestamp;                /// timestamp the payment was cancelled
    uint256 expirationTimestamp;            /// expiration timestamp of the payment  <--- Note that we add the expiration timestamp 
    uint256 totalLimit;                     /// total limit that the customer is willing to pay
    uint256 totalSpent;                     /// total amount spent by the customer
}
```
***Total Limits & Time based limits & Expiration Time***
In this case, we have both `TopUpPayment` as specified in the expiration time case and the `TimeBasedLimits` struct.

#### Register Top Up Pull Payment
Registers a new top up pull payment to the PumaPay Top Up Pull Payment Contract.  
The registration can only be executed by an executor of the PumaPay Pull Payment Contract and the PumaPay Pull Payment. 
The Contract checks that the pull payment has been signed by the customer of the account.  See [Validate Registration](#validate-registration).
The total (and time-based limits and/or expiration timestamp) are set on registration and the total (and time based) amount spent are set to 0.
The initial payment amount for the top up payment is being executed on the registration of the pull payment.
After registration, the initial payment is executed and the business is notified. 
Emits `LogPaymentRegistered` with customer address, pull payment executor address and paymentID.
Emits `LogPullPaymentExecuted` with customer address, paymentID, businessID, amount in PMA and conversion rate.
- - -
***Total Limits*** 
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _paymentIDs  - [0] paymentID, [1] businessID
/// @param _addresses   - [0] customer, [1] pull payment executor, [2] treasury
/// @param _numbers     - [0] initial conversion rate, [1] initial payment amount in cents,
///                       [2] top up amount in cents, [3] start timestamp, [4] total limit
/// @param _currency - currency of the payment / 3-letter abbr i.e. 'EUR'.
function registerPullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32[2] memory _paymentIDs,
    address[3] memory _addresses,
    uint256[5] memory _numbers,
    string memory _currency
)
public
isExecutor()
paymentDoesNotExist(_paymentIDs[0])
isValidString(_currency) {}
```
- - -
***Total Limits & Time Based limits***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _paymentIDs  - [0] paymentID, [1] businessID
/// @param _addresses   - [0] customer, [1] pull payment executor, [2] treasury
/// @param _numbers     - [0] initial conversion rate, [1] initial payment amount in cents, [2] top up amount in cents,
///                       [3] start timestamp, [4] total limit, [5] time based limit, [6] time based period
/// @param _currency - currency of the payment / 3-letter abbr i.e. 'EUR'.
function registerPullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32[2] memory _paymentIDs,
    address[3] memory _addresses,
    uint256[7] memory _numbers,
    string memory _currency
)
public
isExecutor()
paymentDoesNotExist(_paymentIDs[0])
isValidString(_currency) {}
```
- - -
***Total Limits & Expiration Time***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _paymentIDs  - [0] paymentID, [1] businessID
/// @param _addresses   - [0] customer, [1] pull payment executor, [2] treasury
/// @param _numbers     - [0] initial conversion rate, [1] initial payment amount in cents, [2] top up amount in cents,
///                       [3] start timestamp, [4] total limit, [5] expiration timestamp
/// @param _currency - currency of the payment / 3-letter abbr i.e. 'EUR'.
function registerPullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32[2] memory _paymentIDs,
    address[3] memory _addresses,
    uint256[6] memory _numbers,
    string memory _currency
)
public
isExecutor()
paymentDoesNotExist(_paymentIDs[0])
isValidString(_currency)
isValidExpirationTimestamp(_numbers[5]) {}
```

- - -
***Total Limits & Time based limits & Expiration Time***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _paymentIDs  - [0] paymentID, [1] businessID
/// @param _addresses   - [0] customer, [1] pull payment executor, [2] treasury
/// @param _numbers     - [0] initial conversion rate, [1] initial payment amount in cents, [2] top up amount in cents,
///                       [3] start timestamp, [4] total limit, [5] time based limit, [6] time based period, [7] expiration timestamp
/// @param _currency - currency of the payment / 3-letter abbr i.e. 'EUR'.
function registerPullPayment(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32[2] memory _paymentIDs,
    address[3] memory _addresses,
    uint256[8] memory _numbers,
    string memory _currency
)
public
isExecutor()
paymentDoesNotExist(_paymentIDs[0])
isValidString(_currency)
isValidExpirationTimestamp(_numbers[7]) {}
```

#### Validate Registration 
The `isValidRegistration()` method is being called when all the validations have been passed on the `registerPullPayment()` method.
Checks if a registration request is valid by comparing the v, r, s params and the hashed params with the customer address.
- - -
***Total Limits***

```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _pullPayment - pull payment to be validated.
/// @return bool - if the v, r, s params with the hashed params match the customer address
function isValidRegistration(
    uint8 v,
    bytes32 r,
    bytes32 s,
    TopUpPayment memory _pullPayment
)
internal
pure
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _pullPayment.paymentIDs[0],
                _pullPayment.paymentIDs[1],
                _pullPayment.currency,
                _pullPayment.treasuryAddress,
                _pullPayment.initialConversionRate,
                _pullPayment.initialPaymentAmountInCents,
                _pullPayment.topUpAmountInCents,
                _pullPayment.startTimestamp,
                _pullPayment.totalLimit
            )
        ),
        v, r, s) == _pullPayment.customerAddress;
}
``` 
- - -
***Total Limits & Time Based limits***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _pullPayment - pull payment to be validated.
/// @param _timeBasedLimits - time based limits to be validated.
/// @return bool - if the v, r, s params with the hashed params match the customer address
function isValidRegistration(
    uint8 v,
    bytes32 r,
    bytes32 s,
    TopUpPayment memory _pullPayment,
    TimeBasedLimits memory _timeBasedLimits
)
internal
pure
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _pullPayment.paymentIDs[0],
                _pullPayment.paymentIDs[1],
                _pullPayment.currency,
                _pullPayment.treasuryAddress,
                _pullPayment.initialConversionRate,
                _pullPayment.initialPaymentAmountInCents,
                _pullPayment.topUpAmountInCents,
                _pullPayment.startTimestamp,
                _pullPayment.totalLimit,
                _timeBasedLimits.limit,
                _timeBasedLimits.period
            )
        ),
        v, r, s) == _pullPayment.customerAddress;
}
``` 
- - -
***Total Limits & Expiration Time***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _pullPayment - pull payment to be validated.
/// @return bool - if the v, r, s params with the hashed params match the customer address
function isValidRegistration(
    uint8 v,
    bytes32 r,
    bytes32 s,
    TopUpPayment memory _pullPayment
)
internal
pure
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _pullPayment.paymentIDs[0],
                _pullPayment.paymentIDs[1],
                _pullPayment.currency,
                _pullPayment.treasuryAddress,
                _pullPayment.initialConversionRate,
                _pullPayment.initialPaymentAmountInCents,
                _pullPayment.topUpAmountInCents,
                _pullPayment.startTimestamp,
                _pullPayment.expirationTimestamp,
                _pullPayment.totalLimit
            )
        ),
        v, r, s) == _pullPayment.customerAddress;
}
```
- - -
***Total Limits & Time based limits & Expiration Time***
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _pullPayment - pull payment to be validated.
/// @param _timeBasedLimits - time based limits to be validated.
/// @return bool - if the v, r, s params with the hashed params match the customer address
function isValidRegistration(
    uint8 v,
    bytes32 r,
    bytes32 s,
    TopUpPayment memory _pullPayment,
    TimeBasedLimits memory _timeBasedLimits
)
internal
pure
returns (bool)
{
    return ecrecover(
        keccak256(
            abi.encodePacked(
                _pullPayment.paymentIDs[0],
                _pullPayment.paymentIDs[1],
                _pullPayment.currency,
                _pullPayment.treasuryAddress,
                _pullPayment.initialConversionRate,
                _pullPayment.initialPaymentAmountInCents,
                _pullPayment.topUpAmountInCents,
                _pullPayment.startTimestamp,
                _pullPayment.totalLimit,
                _pullPayment.expirationTimestamp,
                _timeBasedLimits.limit,
                _timeBasedLimits.period
            )
        ),
        v, r, s) == _pullPayment.customerAddress;
}
```

#### Cancel Top Up Pull Payment
Cancels a top up pull payment - The cancellation must be executed by one of the executors of the PumaPay Pull Payment Contract. The PumaPay Pull Payment Contract then checks that the pull payment's paymentID and businessID have been signed by the customer address.
See [Validate Cancellation](#validate-cancellation) for more details.
This method sets the cancellation of the pull payment in the pull payments array for this pull payment executor specified.
Emits `LogPaymentCancelled` with pull payment executor address and paymentID.
```solidity
    /// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
    /// @param r - R output of ECDSA signature.
    /// @param s - S output of ECDSA signature.
    /// @param _paymentID - ID of the payment.
    function cancelTopUpPayment(
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 _paymentID
    )
    public
    isExecutor()
    paymentExists(_paymentID)
    paymentNotCancelled(_paymentID) {}
```

#### Validate Cancellation
The `isValidCancellation()` method is used when all the validations have been passed on the `cancelTopUpPayment()` method.
It checks if a cancellation request is valid by comparing the v, r, s params and the hashed params with the customer address.
```solidity
/// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
/// @param r - R output of ECDSA signature.
/// @param s - S output of ECDSA signature.
/// @param _paymentID - ID of the pull payment to be cancelled.
/// @return bool - if the v, r, s params with the hashed params match the customer address
function isValidCancellation(
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes32 _paymentID
)
internal
view
returns (bool){
    return ecrecover(
        keccak256(
            abi.encodePacked(
                pullPayments[_paymentID].paymentIDs[0],
                pullPayments[_paymentID].paymentIDs[1]
            )
        ),
        v, r, s) == pullPayments[_paymentID].customerAddress;
}
```

#### Execute Top Up Pull Payment
Executes a specific top up pull payment based on the payment ID - The pull payment should exist and the payment request should be valid in terms of whether it satisfies parameters i.e. it is within the total and time based limits.
If the top up payment is executed outside the time based period set during registration, then we update the set timestamp for the time based limitations and set the time based amount spent to the top up amount.
If the top up payment is executed within the time based period set on registration, then the time based spent amount is incremented by the top up amount.
For the execution, we calculate the amount in PMA using the conversion rate specified when calling the method.
From the `conversionRate` and the `topUpAmountInCents` we calculate the amount of PMA that the business needs to receive in their treasuryAddress.
The smart contract transfers the PMA amount from the customer account to the treasury.
After execution we set the last payment timestamp to NOW and then increase the total spent amount with the top up amount.
Emits `LogPullPaymentExecuted` with customer address, `msg.sender` as the pull payment executor address and the paymentID.
```solidity
/// @param _paymentID - ID of the payment.
/// @param _conversionRate - conversion rate with which the payment needs to take place
function executeTopUpPayment(bytes32 _paymentID, uint256 _conversionRate)
public
paymentExists(_paymentID)
paymentNotCancelled(_paymentID)
isPullPaymentExecutor(_paymentID)
isValidNumber(_conversionRate)
isWithinTheTotalLimits(_paymentID)
returns (bool)
{
    TopUpPayment storage payment = pullPayments[_paymentID];

    uint256 conversionRate = _conversionRate;
    uint256 amountInPMA = calculatePMAFromFiat(payment.topUpAmountInCents, conversionRate);

    payment.lastPaymentTimestamp = now;
    payment.totalSpent += payment.topUpAmountInCents;

    token.transferFrom(payment.customerAddress, payment.treasuryAddress, amountInPMA);

    emit LogPullPaymentExecuted(
        payment.customerAddress,
        payment.paymentIDs[0],
        payment.paymentIDs[1],
        amountInPMA,
        conversionRate
    );
    return true;
}
```

#### Update Limits
Method that updates the total limit of the top up payment. We check if the update request came from the correct customer and if the 
new limits are above the amount that was spent by the customer until that point. Over/Underflow checks are always in place when it comes to numbers.
The limits can be updated either all together or individually. For more details on the update methods, please check the code.
- - -
***Total Limits***
```solidity
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newLimit - new total limit in FIAT cents
function updateTotalLimit(bytes32 _paymentID, uint256 _newLimit)
public
isCustomer(_paymentID)
isValidNumber(_newLimit)
isValidNewTotalLimit(_paymentID, _newLimit)
{
    uint256 oldLimit = pullPayments[_paymentID].totalLimit;
    pullPayments[_paymentID].totalLimit = _newLimit;

    emit LogTotalLimitUpdated(msg.sender, _paymentID, oldLimit, _newLimit);
}
```
- - -
***Total Limits & Time Based limits***
```solidity
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newLimit - new total limit in FIAT cents
function updateTotalLimit(bytes32 _paymentID, uint256 _newLimit)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit will be updated
/// @param _newLimit - new time based limit in FIAT cents
function updateTimeBasedLimit(bytes32 _paymentID, uint256 _newLimit)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit will be updated
/// @param _newPeriod - new time based period
function updateTimeBasedPeriod(bytes32 _paymentID, uint256 _newPeriod)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit and period will be updated
/// @param _newLimit - new time based limit in FIAT cents
/// @param _newPeriod - new time based period
function updateTimeBasedLimitAndPeriod(bytes32 _paymentID, uint256 _newLimit, uint256 _newPeriod)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit and period will be updated
/// @param _newTotalLimit - new total based limit in FIAT cents
/// @param _newTimeBasedLimit - new time based limit in FIAT cents
/// @param _newTimeBasedPeriod - new time based period
function updateAllLimits(
    bytes32 _paymentID,
    uint256 _newTotalLimit,
    uint256 _newTimeBasedLimit,
    uint256 _newTimeBasedPeriod
) 
```
- - -
***Total Limits & Expiration Time***
```solidity
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newLimit - new total limit in FIAT cents
function updateTotalLimit(bytes32 _paymentID, uint256 _newLimit)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newExpirationTimestamp - new expiration timestamp for the top up payment
function updateExpirationTimestamp(bytes32 _paymentID, uint256 _newExpirationTimestamp)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newLimit - new total limit in FIAT cents
/// @param _newExpirationTimestamp - new expiration timestamp for the top up payment
function updateTotalLimitAndExpirationTimestamp(bytes32 _paymentID, uint256 _newLimit, uint256 _newExpirationTimestamp)
```
- - -
***Total Limits & Time based limits & Expiration Time***
```solidity
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newLimit - new total limit in FIAT cents
function updateTotalLimit(bytes32 _paymentID, uint256 _newLimit)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit will be updated
/// @param _newLimit - new time based limit in FIAT cents
function updateTimeBasedLimit(bytes32 _paymentID, uint256 _newLimit)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit will be updated
/// @param _newPeriod - new time based period
function updateTimeBasedPeriod(bytes32 _paymentID, uint256 _newPeriod)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit and period will be updated
/// @param _newLimit - new time based limit in FIAT cents
/// @param _newPeriod - new time based period
function updateTimeBasedLimitAndPeriod(bytes32 _paymentID, uint256 _newLimit, uint256 _newPeriod)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which total limit will be updated
/// @param _newExpirationTimestamp - new expiration timestamp for the top up payment
function updateExpirationTimestamp(bytes32 _paymentID, uint256 _newExpirationTimestamp)
---------------------------------------------------------------------------------------
/// @param _paymentID - the ID of the payment for which time based limit and period will be updated
/// @param _newTotalLimit - new total based limit in FIAT cents
/// @param _newTimeBasedLimit - new time based limit in FIAT cents
/// @param _newTimeBasedPeriod - new time based period
function updateAllLimits(
    bytes32 _paymentID,
    uint256 _newTotalLimit,
    uint256 _newTimeBasedLimit,
    uint256 _newTimeBasedPeriod,
    uint256 _newExpirationTimestamp
)
```

#### Retrieving Total Limits
The smart contract has the `retrieveLimits()` method which returns the limits for each top up payment.
- - -
***Total Limits*** 
```solidity
/// @param _paymentID - ID of the payment
function retrieveLimits(bytes32 _paymentID)
public
view
returns (uint256 totalLimit, uint256 totalSpent)
{
    return (pullPayments[_paymentID].totalLimit, pullPayments[_paymentID].totalSpent);
}
```

- - -
***Total Limits & Time Based limits***
```solidity
/// @param _paymentID - ID of the payment
function retrieveLimits(bytes32 _paymentID)
public
view
returns
(
    uint256 totalLimit,
    uint256 totalSpent,
    uint256 timeBasedLimit,
    uint256 timeBasedSpent,
    uint256 timeBasedPeriod
)
{
    if (now > timeBasedLimits[_paymentID].setTimestamp.add(timeBasedLimits[_paymentID].period)) {
        return (
        pullPayments[_paymentID].totalLimit,
        pullPayments[_paymentID].totalSpent,
        timeBasedLimits[_paymentID].limit,
        0,
        timeBasedLimits[_paymentID].period
        );
    }
    return (
    pullPayments[_paymentID].totalLimit,
    pullPayments[_paymentID].totalSpent,
    timeBasedLimits[_paymentID].limit,
    timeBasedLimits[_paymentID].spent,
    timeBasedLimits[_paymentID].period
    );
}
```
- - -
***Total Limits & Expiration Time***
```solidity
/// @param _paymentID - ID of the payment
function retrieveLimits(bytes32 _paymentID)
public
view
returns (uint256 totalLimit, uint256 totalSpent, uint256 expirationTimestamp)
{
    return (pullPayments[_paymentID].totalLimit, pullPayments[_paymentID].totalSpent, pullPayments[_paymentID].expirationTimestamp);
}
```
- - -
***Total Limits & Time based limits & Expiration Time***
```solidity
/// @param _paymentID - ID of the payment
function retrieveLimits(bytes32 _paymentID)
public
view
returns
(
    uint256 totalLimit,
    uint256 totalSpent,
    uint256 timeBasedLimit,
    uint256 timeBasedSpent,
    uint256 timeBasedPeriod,
    uint256 expirationTimestamp
)
{
    if (now > timeBasedLimits[_paymentID].setTimestamp.add(timeBasedLimits[_paymentID].period)) {
        return (
        pullPayments[_paymentID].totalLimit,
        pullPayments[_paymentID].totalSpent,
        timeBasedLimits[_paymentID].limit,
        0,
        timeBasedLimits[_paymentID].period,
        pullPayments[_paymentID].expirationTimestamp
        );
    }
    return (
    pullPayments[_paymentID].totalLimit,
    pullPayments[_paymentID].totalSpent,
    timeBasedLimits[_paymentID].limit,
    timeBasedLimits[_paymentID].spent,
    timeBasedLimits[_paymentID].period,
    pullPayments[_paymentID].expirationTimestamp
    );
}
```
