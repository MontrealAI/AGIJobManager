// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract RevertingERC20 {
    function transfer(address, uint256) external pure returns (bool) {
        revert();
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert();
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
}
