// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "../AGIJobManager.sol";

contract TestableAGIJobManager is AGIJobManager {
    constructor(
        address agiTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots
    ) AGIJobManager(agiTokenAddress, baseIpfs, ensConfig, rootNodes, merkleRoots) {}

    function setValidationRewardPercentageUnsafe(uint256 _percentage) external {
        validationRewardPercentage = _percentage;
    }

    function setJobMetadata(
        uint256 jobId,
        string calldata completionURI,
        bool completionRequested,
        bool mintNft
    ) external {
        Job storage job = jobs[jobId];
        job.jobCompletionURI = completionURI;
        job.completionRequested = completionRequested;
        if (mintNft) {
            _mintJobNft(job);
        }
    }
}
