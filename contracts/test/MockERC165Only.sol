// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockERC165Only {
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7;
    }
}
