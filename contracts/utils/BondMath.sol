// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library BondMath {
    /// @dev Bond outputs are always clamped to payout and optional min/max rails.
    function computeValidatorBond(
        uint256 payout,
        uint256 bps,
        uint256 minBond,
        uint256 maxBond
    ) external pure returns (uint256 bond) {
        if (bps == 0 && minBond == 0 && maxBond == 0) {
            return 0;
        }
        bond = (payout * bps) / 10_000;
        if (bond < minBond) bond = minBond;
        if (maxBond != 0 && bond > maxBond) bond = maxBond;
        if (bond > payout) bond = payout;
    }

    function computeAgentBond(
        uint256 payout,
        uint256 duration,
        uint256 bps,
        uint256 minBond,
        uint256 maxBond,
        uint256 durationLimit
    ) external pure returns (uint256 bond) {
        if (bps == 0 && minBond == 0 && maxBond == 0) {
            return 0;
        }
        bond = (payout * bps) / 10_000;
        if (bond < minBond) bond = minBond;
        if (durationLimit != 0) {
            bond += (bond * duration) / durationLimit;
        }
        if (maxBond != 0 && bond > maxBond) bond = maxBond;
        if (bond > payout) bond = payout;
    }
}
