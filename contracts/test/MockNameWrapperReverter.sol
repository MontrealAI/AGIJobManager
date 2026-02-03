// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

contract MockNameWrapperReverter {
    function ownerOf(uint256) external pure returns (address) {
        revert("NAMEWRAPPER_DISABLED");
    }
}
