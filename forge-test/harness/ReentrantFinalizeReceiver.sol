// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IAGIJobManagerFinalize {
    function finalizeJob(uint256 jobId) external;
}

contract ReentrantFinalizeReceiver is IERC721Receiver {
    IAGIJobManagerFinalize public immutable manager;
    uint256 public reentryJobId;
    bool public attempted;
    bool public reentrySucceeded;

    constructor(address managerAddress) {
        manager = IAGIJobManagerFinalize(managerAddress);
    }

    function setReentryJobId(uint256 jobId) external {
        reentryJobId = jobId;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        if (!attempted) {
            attempted = true;
            (bool ok,) =
                address(manager).call(abi.encodeWithSelector(IAGIJobManagerFinalize.finalizeJob.selector, reentryJobId));
            reentrySucceeded = ok;
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}
