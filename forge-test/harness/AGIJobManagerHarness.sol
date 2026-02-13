// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "contracts/AGIJobManager.sol";

contract AGIJobManagerHarness is AGIJobManager {
    constructor(
        address agiTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots
    ) AGIJobManager(agiTokenAddress, baseIpfs, ensConfig, rootNodes, merkleRoots) {}

    function activeJobsByAgentView(address agent) external view returns (uint256) {
        return activeJobsByAgent[agent];
    }

    function jobExists(uint256 jobId) external view returns (bool) {
        return jobs[jobId].employer != address(0);
    }

    function jobEscrowReleased(uint256 jobId) external view returns (bool) {
        return jobs[jobId].escrowReleased;
    }

    function jobAgentBondAmount(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].agentBondAmount;
    }

    function jobDisputeBondAmount(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].disputeBondAmount;
    }

    function jobValidatorBondAmount(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].validatorBondAmount;
    }

    function jobValidatorsLength(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].validators.length;
    }

    function jobPayout(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].payout;
    }

    function jobAssignedAgent(uint256 jobId) external view returns (address) {
        return jobs[jobId].assignedAgent;
    }

    function jobEmployer(uint256 jobId) external view returns (address) {
        return jobs[jobId].employer;
    }

    function jobFlags(uint256 jobId) external view returns (bool, bool, bool, bool) {
        Job storage job = jobs[jobId];
        return (job.completed, job.disputed, job.expired, job.completionRequested);
    }
}
