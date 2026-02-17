// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAGIJobManagerForReceiver {
    function createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external;
    function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external;
    function requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI) external;
    function finalizeJob(uint256 _jobId) external;
}

contract MaliciousCompletionReceiver {
    IAGIJobManagerForReceiver public immutable manager;
    IERC20 public immutable token;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(address manager_, address token_) {
        manager = IAGIJobManagerForReceiver(manager_);
        token = IERC20(token_);
    }

    function createAndFundJob(uint256 payout, uint256 duration) external {
        token.approve(address(manager), type(uint256).max);
        manager.createJob("ipfs://spec", payout, duration, "details");
    }

    function applyAsAgent(uint256 jobId) external {
        manager.applyForJob(jobId, "", new bytes32[](0));
    }

    function requestCompletion(uint256 jobId) external {
        manager.requestJobCompletion(jobId, "ipfs://completion");
    }

    function finalize(uint256 jobId) external {
        manager.finalizeJob(jobId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        reentryAttempts += 1;
        (bool ok,) = address(manager).call(abi.encodeWithSignature("finalizeJob(uint256)", 0));
        reentrySucceeded = ok;
        return this.onERC721Received.selector;
    }
}
