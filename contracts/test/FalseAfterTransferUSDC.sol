// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MockUSDCControls.sol";

contract FalseAfterTransferUSDC is MockUSDCControls {
    bool public returnFalse;
    function setReturnFalse(bool value) external { returnFalse = value; }
    function transfer(address to, uint256 amount) public override returns (bool) {
        super.transfer(to, amount);
        return !returnFalse;
    }
}
