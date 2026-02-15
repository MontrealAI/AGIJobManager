// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract HookGasBurner {
    function handleHook(uint8, uint256) external pure {
        uint256 acc;
        for (uint256 i = 0; i < 1_000_000; ++i) {
            acc += i;
        }
        if (acc == 1) revert();
    }
}
