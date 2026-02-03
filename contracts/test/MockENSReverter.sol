// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

contract MockENSReverter {
    function resolver(bytes32) external pure returns (address) {
        revert("ENS_DISABLED");
    }
}
