// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockGasGriefERC165 {
    function supportsInterface(bytes4) external pure returns (bool) {
        while (true) {}
        return false;
    }
}
