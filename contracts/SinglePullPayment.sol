pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./ownership/PayableOwnable.sol";

/// @title PumaPay Single Pull Payment - Contract that facilitates our pull payment protocol
/// The single pull payment smart contract allows for the amount to be defined in PMA rather than in FIAT.
/// This optimization reduces the gas costs that we had in place for the calculation of PMA amount from FIAT
/// compared to the previous versions of our smart contracts (v1 and v2). Also, we don't need to worry about PMA/FIAT rates
/// on the blockchain anymore since we are taking care of that on the wallet side by having the user signing the amount of PMA directly.
/// @author PumaPay Dev Team - <developers@pumapay.io>
contract SinglePullPayment is PayableOwnable {

    using SafeMath for uint256;
    /// ===============================================================================================================
    ///                                      Events
    /// ===============================================================================================================

    event LogExecutorAdded(address executor);
    event LogExecutorRemoved(address executor);

    event LogPullPaymentExecuted(
        address customerAddress,
        address receiverAddress,
        uint256 amountInPMA,
        bytes32 paymentID,
        bytes32 businessID,
        string uniqueReferenceID
    );

    /// ===============================================================================================================
    ///                                      Constants
    /// ===============================================================================================================
    bytes32 constant private EMPTY_BYTES32 = "";

    /// ===============================================================================================================
    ///                                      Members
    /// ===============================================================================================================
    IERC20 public token;
    mapping(address => bool) public executors;
    mapping(bytes32 => PullPayment) public pullPayments;

    struct PullPayment {
        bytes32[2] paymentDetails;              /// [0] paymentID / [1] businessID
        uint256 paymentAmount;                  /// payment amount in fiat in cents
        address customerAddress;                /// wallet address of customer
        address receiverAddress;                /// address which pma tokens will be transfer to on execution
        string uniqueReferenceID;
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
    modifier isValidNumber(uint256 _amount) {
        require(_amount > 0, "Invalid amount - Must be higher than zero");
        _;
    }
    modifier isValidByte32(bytes32 _text) {
        require(_text != EMPTY_BYTES32, "Invalid byte32 value.");
        _;
    }
    modifier pullPaymentDoesNotExists(address _customerAddress, bytes32 _paymentID) {
        require(pullPayments[_paymentID].paymentDetails[0] == EMPTY_BYTES32, "Pull payment already exists - Payment ID");
        require(pullPayments[_paymentID].paymentDetails[1] == EMPTY_BYTES32, "Pull payment already exists - Business ID");
        require(pullPayments[_paymentID].paymentAmount == 0, "Pull payment already exists - Payment Amount");
        require(pullPayments[_paymentID].receiverAddress == address(0), "Pull payment already exists - Receiver Address");
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
    ///                                      Public Functions - Owner Only
    /// ===============================================================================================================

    /// @dev Adds a new executor. - can be executed only by the owner.
    /// @param _executor - address of the executor which cannot be zero address.
    function addExecutor(address payable _executor)
    public
    onlyOwner
    isValidAddress(_executor)
    executorDoesNotExists(_executor)
    {
        executors[_executor] = true;

        emit LogExecutorAdded(_executor);
    }

    /// @dev Removes a new executor. - can be executed only by the owner.
    /// @param _executor - address of the executor which cannot be zero address.
    function removeExecutor(address payable _executor)
    public
    onlyOwner
    isValidAddress(_executor)
    executorExists(_executor)
    {
        executors[_executor] = false;

        emit LogExecutorRemoved(_executor);
    }

    /// ===============================================================================================================
    ///                                      Public Functions - Executors Only
    /// ===============================================================================================================

    /// @dev Registers a new pull payment to the PumaPay Pull Payment Contract - The method can be executed only
    /// by one of the executors of the PumaPay Pull Payment Contract.
    /// It creates a new pull payment in the 'pullPayments' mapping and it transfers the amount
    /// It also transfer the PMA amount from the customer address to the receiver address.
    /// Emits 'LogPullPaymentExecuted' with customer address, receiver address, PMA amount, the paymentID, businessID and uniqueReferenceID
    /// @param v - recovery ID of the ETH signature. - https://github.com/ethereum/EIPs/issues/155
    /// @param r - R output of ECDSA signature.
    /// @param s - S output of ECDSA signature.
    /// @param _paymentDetails - all the relevant id-related details for the payment.
    /// @param _addresses - all the relevant addresses for the payment.
    /// @param _paymentAmount - amount in PMA to be transferred to the receiver.
    /// @param _uniqueReferenceID - unique reference ID of the pull payment.
    function registerPullPayment(
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32[2] memory _paymentDetails, /// [0] paymentID, [1] businessID
        address[2] memory _addresses, /// [0] customerAddress, [1] receiverAddress
        uint256 _paymentAmount,
        string memory _uniqueReferenceID
    )
    public
    isExecutor()
    isValidByte32(_paymentDetails[0])
    isValidByte32(_paymentDetails[1])
    isValidNumber(_paymentAmount)
    isValidAddress(_addresses[0])
    isValidAddress(_addresses[1])
    pullPaymentDoesNotExists(_addresses[0], _paymentDetails[0])
    {
        bytes32[2] memory paymentDetails = _paymentDetails;

        pullPayments[paymentDetails[0]].paymentDetails = _paymentDetails;
        pullPayments[paymentDetails[0]].paymentAmount = _paymentAmount;
        pullPayments[paymentDetails[0]].customerAddress = _addresses[0];
        pullPayments[paymentDetails[0]].receiverAddress = _addresses[1];
        pullPayments[paymentDetails[0]].uniqueReferenceID = _uniqueReferenceID;

        require(isValidRegistration(
                v,
                r,
                s,
                pullPayments[paymentDetails[0]]),
            "Invalid pull payment registration - ECRECOVER_FAILED"
        );

        token.transferFrom(
            _addresses[0],
            _addresses[1],
            _paymentAmount
        );

        emit LogPullPaymentExecuted(
            _addresses[0],
            _addresses[1],
            _paymentAmount,
            paymentDetails[0],
            paymentDetails[1],
            _uniqueReferenceID
        );
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
        PullPayment memory _pullPayment
    )
    internal
    pure
    returns (bool)
    {
        return ecrecover(
            keccak256(
                abi.encodePacked(
                    _pullPayment.paymentDetails[0],
                    _pullPayment.paymentDetails[1],
                    _pullPayment.paymentAmount,
                    _pullPayment.customerAddress,
                    _pullPayment.receiverAddress,
                    _pullPayment.uniqueReferenceID
                )
            ),
            v, r, s) == _pullPayment.customerAddress;
    }
}
