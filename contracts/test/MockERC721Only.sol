// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockERC721Only {
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd;
    }
}
