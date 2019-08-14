pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract TopUpPullPayment {
    using SafeMath for uint256;

    /// ===============================================================================================================
    ///                                      Events
    /// ===============================================================================================================

    event LogExecutorAdded(address executor);
    event LogExecutorRemoved(address executor);
    event LogSmartContractActorFunded(string actorRole, address payable actor, uint256 timestamp);
    event LogPaymentRegistered(
        address customerAddress,
        bytes32 paymentID,
        bytes32 businessID
    );
    event LogPaymentCancelled(
        address customerAddress,
        bytes32 paymentID,
        bytes32 businessID
    );
    event LogPullPaymentExecuted(
        address customerAddress,
        bytes32 paymentID,
        bytes32 businessID,
        uint256 amountInPMA,
        uint256 conversionRate
    );

    /// ===============================================================================================================
    ///                                      Constants
    /// ===============================================================================================================
    uint256 constant private RATE_CALCULATION_NUMBER = 10 ** 26;    /// Check `calculatePMAFromFiat()` for more details
    uint256 constant private OVERFLOW_LIMITER_NUMBER = 10 ** 20;    /// 1e^20 - Prevent numeric overflows
    uint256 constant private FIAT_TO_CENT_FIXER = 100;              /// Fiat currencies have 100 cents in 1 basic monetary unit.

    /// ===============================================================================================================
    ///                                      Members
    /// ===============================================================================================================
    IERC20 public token;
    mapping(address => bool) public executors;
    mapping(bytes32 => TopUpPayment) pullPayments;

    struct TopUpPayment {
        bytes32[2] paymentIDs;                  /// [0] paymentID / [1] businessID
        string currency;                        /// 3-letter abbr i.e. 'EUR' / 'USD' etc.
        address customerAddress;                /// wallet address of customer
        address treasuryAddress;                /// address which pma tokens will be transfer to on execution
        uint256 initialConversionRate;          /// conversion rate for first payment execution
        uint256 initialPaymentAmountInCents;    /// initial payment amount in fiat in cents
        uint256 topUpAmountInCents;             /// payment amount in fiat in cents
        uint256 startTimestamp;                 /// when subscription starts - in seconds
        uint256 nextPaymentTimestamp;           /// timestamp of next payment
        uint256 lastPaymentTimestamp;           /// timestamp of last payment
        uint256 cancelTimestamp;                /// timestamp the payment was cancelled
        uint256 totalLimit;                     /// total limit that the customer is willing to pay
        uint256 totalSpent;                     /// total amount spent by the customer
        TimeBasedLimit limits;
    }

    struct TimeBasedLimit {
        uint256 limit; /// 100 EUR
        uint256 spent; /// 10 EUR
        uint256 period; /// week
        uint256 setTimestamp;
    }

    /// ===============================================================================================================
    ///                                      Modifiers
    /// ===============================================================================================================
    modifier isExecutor() {
        require(executors[msg.sender], "msg.sender not an executor");
        _;
    }
    modifier executorExists(address _executor) {
        require(executors[_executor], "Executor does not exists.");
        _;
    }
    modifier executorDoesNotExists(address _executor) {
        require(!executors[_executor], "Executor already exists.");
        _;
    }

    modifier isValidAddress(address _address) {
        require(_address != address(0), "Invalid address - ZERO_ADDRESS provided");
        _;
    }
    modifier validAmount(uint256 _amount) {
        require(_amount > 0, "Invalid amount - Must be higher than zero");
        require(_amount <= OVERFLOW_LIMITER_NUMBER, "Invalid amount - Must be lower than the overflow limit.");
        _;
    }

    /// ===============================================================================================================
    ///                                      Constructor
    /// ===============================================================================================================
    /// @dev Contract constructor - sets the token address that the contract facilitates.
    /// @param _token Token Address.
    constructor(address _token)
    public {
        require(_token != address(0), "Invalid address for token - ZERO_ADDRESS provided");
        token = IERC20(_token);
    }
    // @notice Will receive any eth sent to the contract
    function() external payable {
    }

    /// ===============================================================================================================
    ///                                      Public Functions - Executors Only
    /// ===============================================================================================================
    /// @dev Registers a new pull payment to the PumaPay Pull Payment Contract - The registration can be executed only
    /// by one of the executors of the PumaPay Pull Payment Contract
    /// and the PumaPay Pull Payment Contract checks that the pull payment has been singed by the customer of the account.
    /// If the pull payment doesn't have a trial period, the first execution will take place.'
    /// The pull payment is updated accordingly in terms of how many payments can happen, and when is the next payment date.
    /// (For more details on the above check the 'executePullPayment' method.
    /// The balance of the executor (msg.sender) is checked and if funding is needed 0.5 ETH is transferred.
    /// Emits 'LogPaymentRegistered' with customer address, pull payment executor address and paymentID.
    /// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
    /// @param r - R output of ECDSA signature.
    /// @param s - S output of ECDSA signature.
    /// @param _paymentIDs - [0] paymentID, [1] businessID
    /// @param _addresses -   [0] customer, [1] pull payment executor, [2] treasury
    /// @param _numbers - all the relevant amounts for the payment.
    /// @param _currency - currency of the payment / 3-letter abbr i.e. 'EUR'.
    function registerPullPayment(
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32[2] memory _paymentIDs,
        address[3] memory _addresses,
        uint256[9] memory _numbers,
        string memory _currency
    )
    public
    isExecutor()
    {

        pullPayments[_paymentIDs[0]].paymentIDs[0] = _paymentIDs[0];
        pullPayments[_paymentIDs[0]].paymentIDs[1] = _paymentIDs[1];
        pullPayments[_paymentIDs[0]].currency = _currency;
        pullPayments[_paymentIDs[0]].customerAddress = _addresses[0];
        pullPayments[_paymentIDs[0]].treasuryAddress = _addresses[2];

        pullPayments[_paymentIDs[0]].initialConversionRate = _numbers[0];
        pullPayments[_paymentIDs[0]].initialPaymentAmountInCents = _numbers[1];
        pullPayments[_paymentIDs[0]].topUpAmountInCents = _numbers[2];
        pullPayments[_paymentIDs[0]].startTimestamp = _numbers[3];
        pullPayments[_paymentIDs[0]].totalLimit = _numbers[4];
        pullPayments[_paymentIDs[0]].limits.limit = _numbers[5];
        pullPayments[_paymentIDs[0]].limits.period = _numbers[6];

        require(isValidRegistration(
                v,
                r,
                s,
                pullPayments[_paymentIDs[0]]),
            "Invalid pull payment registration - ECRECOVER_FAILED"
        );

        executePullPaymentOnRegistration(
            [_paymentIDs[0], _paymentIDs[1]],
            [_addresses[0], _addresses[2]],
            [_numbers[1], _numbers[0]]
        );

        emit LogPaymentRegistered(_addresses[0], _paymentIDs[0], _paymentIDs[1]);
    }

    /// @dev Executes a pull payment for the msg.sender - The pull payment should exist and the payment request
    /// should be valid in terms of when it can be executed.
    /// Emits 'LogPullPaymentExecuted' with customer address, msg.sender as the pull payment executor address and the paymentID.
    /// Use Case: Single/Recurring Fixed Pull Payment
    /// ------------------------------------------------
    /// We calculate the amount in PMA using the conversion rate specified when calling the method.
    /// From the 'conversionRate' and the 'topUpAmountInCents' we calculate the amount of PMA that
    /// the business need to receive in their treasuryAddress.
    /// The smart contract transfers from the customer account to the treasury wallet the amount in PMA.
    /// After execution we set the last payment timestamp to NOW, the next payment timestamp is incremented by
    /// the frequency and the number of payments is decreased by 1.
    /// @param _paymentID - ID of the payment.
    /// @param _conversionRate -
    /// @param _paymentNumber -
    function executeTopUpPayment(bytes32 _paymentID, uint256 _conversionRate, uint256 _paymentNumber)
    public
    validAmount(_conversionRate)
    validAmount(_paymentNumber)
    returns (bool)
    {
        TopUpPayment memory payment = pullPayments[_paymentID];
        uint256 conversionRate = _conversionRate;
        uint256 amountInPMA = calculatePMAFromFiat(payment.topUpAmountInCents, conversionRate);

        /// TODO: Need to take into consideration global limits also - should be a modifier
        if (now > payment.limits.setTimestamp + payment.limits.period && payment.limits.limit > payment.limits.spent) {
            /// set timestamp is zero
            payment.limits.setTimestamp = now; ///// 1000000000
            payment.limits.spent = payment.topUpAmountInCents;
        } else if (now < payment.limits.setTimestamp + payment.limits.period && payment.limits.limit > payment.limits.spent) {
            payment.limits.spent += payment.topUpAmountInCents;
        } else {
            revert(); /// This should be a modifier
        }

        payment.lastPaymentTimestamp = now;
        payment.totalSpent += payment.topUpAmountInCents;

        token.transferFrom(
            payment.customerAddress,
            payment.treasuryAddress,
            amountInPMA
        );
        emit LogPullPaymentExecuted(
            payment.customerAddress,
            payment.paymentIDs[0],
            payment.paymentIDs[1],
            amountInPMA,
            conversionRate
        );
        return true;
    }

    /// ===============================================================================================================
    ///                                      Internal Functions
    /// ===============================================================================================================
    /// @dev Checks if a registration request is valid by comparing the v, r, s params
    /// and the hashed params with the customer address.
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
                    _pullPayment.totalLimit,
                    _pullPayment.limits.limit,
                    _pullPayment.limits.period
                )
            ),
            v, r, s) == _pullPayment.customerAddress;
    }

    /// @dev The new version of the smart contract allows for the first execution to happen on registration,
    /// unless the pull payment has free trial. Check the comments on 'registerPullPayment' method for more details.
    /// @param _paymentIDs - [0] paymentID, [1] businessID
    /// @param _addresses -   [0] customer, [1] treasury
    /// @param _paymentAmounts - [0] initial payment in cents, [1] conversion rate
    function executePullPaymentOnRegistration(
        bytes32[2] memory _paymentIDs,
        address[2] memory _addresses,
        uint256[2] memory _paymentAmounts
    )
    internal
    returns (bool) {
        uint256 amountInPMA = calculatePMAFromFiat(_paymentAmounts[0], _paymentAmounts[1]);
        token.transferFrom(_addresses[0], _addresses[1], amountInPMA);
        emit LogPullPaymentExecuted(
            _addresses[0],
            _paymentIDs[0],
            _paymentIDs[1],
            amountInPMA,
            _paymentAmounts[1]
        );
        return true;
    }

    /// @dev Calculates the PMA Rate for the fiat currency specified - The rate is set every 10 minutes by our PMA server
    /// for the currencies specified in the smart contract.
    /// @param _topUpAmountInCents - payment amount in fiat CENTS so that is always integer
    /// @param _conversionRate - conversion rate with which the payment needs to take place
    /// RATE CALCULATION EXAMPLE
    /// ------------------------
    /// RATE ==> 1 PMA = 0.01 USD$
    /// 1 USD$ = 1/0.01 PMA = 100 PMA
    /// Start the calculation from one ether - PMA Token has 18 decimals
    /// Multiply by the DECIMAL_FIXER (1e+10) to fix the multiplication of the rate
    /// Multiply with the fiat amount in cents
    /// Divide by the Rate of PMA to Fiat in cents
    /// Divide by the FIAT_TO_CENT_FIXER to fix the _topUpAmountInCents
    /// ---------------------------------------------------------------------------------------------------------------
    /// To save on gas, we have 'pre-calculated' the equation below and have set a constant in its place.
    /// ONE_ETHER.mul(DECIMAL_FIXER).div(FIAT_TO_CENT_FIXER) = RATE_CALCULATION_NUMBER
    /// ONE_ETHER = 10^18           |
    /// DECIMAL_FIXER = 10^10       |   => 10^18 * 10^10 / 100 ==> 10^26  => RATE_CALCULATION_NUMBER = 10^26
    /// FIAT_TO_CENT_FIXER = 100    |
    /// NOTE: The aforementioned value is linked to the OVERFLOW_LIMITER_NUMBER which is set to 10^20.
    /// ---------------------------------------------------------------------------------------------------------------
    function calculatePMAFromFiat(uint256 _topUpAmountInCents, uint256 _conversionRate)
    internal
    pure
    validAmount(_topUpAmountInCents)
    validAmount(_conversionRate)
    returns (uint256) {
        return RATE_CALCULATION_NUMBER.mul(_topUpAmountInCents).div(_conversionRate);
    }
}

