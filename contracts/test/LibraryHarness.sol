// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../utils/BondMath.sol";
import "../utils/ReputationMath.sol";
import "../utils/ENSOwnership.sol";

contract LibraryHarness {
    function computeAgentBond(
        uint256 payout,
        uint256 duration,
        uint256 bps,
        uint256 minBond,
        uint256 maxBond,
        uint256 durationLimit
    ) external pure returns (uint256) {
        return BondMath.computeAgentBond(payout, duration, bps, minBond, maxBond, durationLimit);
    }

    function computeValidatorBond(
        uint256 payout,
        uint256 bps,
        uint256 minBond,
        uint256 maxBond
    ) external pure returns (uint256) {
        return BondMath.computeValidatorBond(payout, bps, minBond, maxBond);
    }

    function computeReputationPoints(
        uint256 payout,
        uint256 duration,
        uint256 completionRequestedAt,
        uint256 assignedAt,
        bool repEligible
    ) external pure returns (uint256) {
        return ReputationMath.computeReputationPoints(
            payout,
            duration,
            completionRequestedAt,
            assignedAt,
            repEligible
        );
    }

    function verifyENSOwnership(
        address ensAddress,
        address nameWrapperAddress,
        address claimant,
        string memory subdomain,
        bytes32 rootNode
    ) external view returns (bool) {
        return ENSOwnership.verifyENSOwnership(ensAddress, nameWrapperAddress, claimant, subdomain, rootNode);
    }
}
