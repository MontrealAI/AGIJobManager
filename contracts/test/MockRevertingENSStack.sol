// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockRevertingENSRegistry {
    function owner(bytes32) external pure returns (address) {
        return address(0);
    }

    function resolver(bytes32) external pure returns (address) {
        revert();
    }
}

contract MockRevertingNameWrapper {
    function ownerOf(uint256) external pure returns (address) {
        revert();
    }
}
