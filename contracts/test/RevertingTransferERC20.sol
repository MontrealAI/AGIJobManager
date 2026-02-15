// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RevertingTransferERC20 is ERC20 {
    constructor() ERC20("Reverting Transfer ERC20", "RVTX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert("transfer reverted");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("transferFrom reverted");
    }
}
