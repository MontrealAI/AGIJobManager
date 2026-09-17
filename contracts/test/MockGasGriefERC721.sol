// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockGasGriefERC721 {
    function supportsInterface(bytes4) external pure returns (bool) {
        while (true) { /* Deliberate out-of-gas ERC-165 fixture. */ // solhint-disable-line no-empty-blocks
        }
        return false;
    }
}
