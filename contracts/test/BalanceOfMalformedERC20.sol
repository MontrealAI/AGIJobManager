// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BalanceOfMalformedERC20 {
    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function balanceOf(address) external pure returns (uint256) {
        assembly {
            mstore(0x00, 0x01)
            return(0x1f, 0x01)
        }
    }
}
