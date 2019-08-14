pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/access/Roles.sol";

contract ExecutorRole {
    using Roles for Roles.Role;

    event ExecutorAdded(address indexed account);
    event ExecutorRemoved(address indexed account);

    Roles.Role private _executors;

    constructor () internal {
        _addExecutor(msg.sender);
    }

    modifier onlyExecutor() {
        require(isExecutor(msg.sender), "ExecutorRole: caller does not have the Executor role");
        _;
    }

    function isExecutor(address account) public view returns (bool) {
        return _executors.has(account);
    }

    function addExecutor(address account) public onlyExecutor {
        _addExecutor(account);
    }

    function renounceExecutor() public {
        _removeExecutor(msg.sender);
    }

    function _addExecutor(address account) internal {
        _executors.add(account);
        emit ExecutorAdded(account);
    }

    function _removeExecutor(address account) internal {
        _executors.remove(account);
        emit ExecutorRemoved(account);
    }
}
