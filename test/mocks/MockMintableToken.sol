pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

contract MockMintableToken is ERC20Mintable {
    string public name = "PumaPayTest";
    string public symbol = "TPMA";
    uint8 public decimals = 18;
}
