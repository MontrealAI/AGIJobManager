// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../AGIJobManager.sol";

contract TestableAGIJobManager is AGIJobManager {
    constructor(
        string memory _baseIpfsUrl,
        address _ensAddress,
        address _nameWrapperAddress,
        bytes32 _validatorMerkleRoot,
        bytes32 _agentMerkleRoot
    )
        AGIJobManager(
            _baseIpfsUrl,
            _ensAddress,
            _nameWrapperAddress,
            _validatorMerkleRoot,
            _agentMerkleRoot
        )
    {}

    function setValidationRewardPercentageUnsafe(uint256 _percentage) external {
        validationRewardPercentage = _percentage;
    }

    function setJobMetadata(
        uint256 jobId,
        string calldata completionURI,
        string calldata ipfsHash,
        bool completionRequested,
        bool mintNft
    ) external {
        Job storage job = jobs[jobId];
        job.jobCompletionURI = completionURI;
        job.ipfsHash = ipfsHash;
        job.completionRequested = completionRequested;
        if (mintNft) {
            _mintJobNft(job);
        }
    }
}
