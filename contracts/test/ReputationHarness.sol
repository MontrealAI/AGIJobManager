// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../AGIJobManager.sol";

contract ReputationHarness is AGIJobManager {
    constructor(
        address agiTokenAddress,
        string memory baseIpfs,
        address[2] memory ensConfig,
        bytes32[4] memory rootNodes,
        bytes32[2] memory merkleRoots
    ) AGIJobManager(agiTokenAddress, baseIpfs, ensConfig, rootNodes, merkleRoots) {}

    function grantReputation(address user, uint256 points) external {
        enforceReputationGrowth(user, points);
    }
}
