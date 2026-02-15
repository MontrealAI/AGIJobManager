// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IENSJobPagesLike {
    function handleHook(uint8 hook, uint256 jobId) external;
}

contract MockHookCaller {
    function callHandleHook(address target, uint8 hook, uint256 jobId) external {
        IENSJobPagesLike(target).handleHook(hook, jobId);
    }

    function callHandleHookRaw44(address target, uint8 hook, uint256 jobId) external returns (bool success) {
        bytes memory payload = abi.encodeWithSelector(IENSJobPagesLike.handleHook.selector, hook, jobId);
        require(payload.length == 0x44, "bad-payload");
        assembly {
            success := call(gas(), target, 0, add(payload, 0x20), 0x44, 0, 0)
        }
    }
}
