// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockBrokenERC721 {
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }

    function balanceOf(address) external pure returns (uint256) {
        revert("broken");
    }
}
