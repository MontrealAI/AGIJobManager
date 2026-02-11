// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockLoopingERC721 {
    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }

    function balanceOf(address) external pure returns (uint256) {
        while (true) {}
        return 0;
    }
}
