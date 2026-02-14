// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IENSJobPagesLike {
    function handleHook(uint8 hook, uint256 jobId) external;
}

contract MockHookCaller {
    function callHandleHook(address target, uint8 hook, uint256 jobId) external {
        IENSJobPagesLike(target).handleHook(hook, jobId);
    }

    function callRaw(address target, bytes calldata payload) external returns (bool success, bytes memory returndata) {
        (success, returndata) = target.call(payload);
    }
}
