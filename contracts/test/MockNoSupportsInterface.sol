// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNoSupportsInterface {
    function ping() external pure returns (uint256) {
        return 1;
    }
}
