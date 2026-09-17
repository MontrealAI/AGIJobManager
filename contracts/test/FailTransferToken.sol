// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FailTransferToken is ERC20 {
    function decimals() public pure override returns (uint8) { return 6; }

    constructor() ERC20("Fail Transfer Token", "FAIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }
}
