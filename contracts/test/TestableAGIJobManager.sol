// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../AGIJobManager.sol";

contract TestableAGIJobManager is AGIJobManager {
    constructor(
        address _agiTokenAddress,
        string memory _baseIpfsUrl,
        address _ensAddress,
        address _nameWrapperAddress,
        bytes32 _clubRootNode,
        bytes32 _agentRootNode,
        bytes32 _validatorMerkleRoot,
        bytes32 _agentMerkleRoot
    )
        AGIJobManager(
            _agiTokenAddress,
            _baseIpfsUrl,
            _ensAddress,
            _nameWrapperAddress,
            _clubRootNode,
            _agentRootNode,
            _validatorMerkleRoot,
            _agentMerkleRoot
        )
    {}

    function setValidationRewardPercentageUnsafe(uint256 _percentage) external onlyOwner {
        validationRewardPercentage = _percentage;
    }

    function setJobMetadata(uint256 jobId, string calldata completionURI, string calldata ipfsHash) external onlyOwner {
        Job storage job = jobs[jobId];
        job.jobCompletionURI = completionURI;
        job.ipfsHash = ipfsHash;
    }

    function setCompletionRequested(uint256 jobId, bool requested) external onlyOwner {
        Job storage job = jobs[jobId];
        job.completionRequested = requested;
        if (!requested) {
            job.completionRequestedAt = 0;
        }
    }

    function mintJobNftUnsafe(uint256 jobId) external {
        Job storage job = jobs[jobId];
        _mintJobNft(job);
    }
}
