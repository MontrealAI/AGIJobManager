// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/math/Math.sol";

library BondMath {
    function computeValidatorBond(
        uint256 payout,
        uint256 bps,
        uint256 minBond,
        uint256 maxBond
    ) external pure returns (uint256 bond) {
        if (bps == 0 && minBond == 0 && maxBond == 0) {
            return 0;
        }
        bond = Math.mulDiv(payout, bps, 10_000);
        if (bond < minBond) bond = minBond;
        if (bond > maxBond) bond = maxBond;
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
        bond = Math.mulDiv(payout, bps, 10_000);
        if (bond < minBond) bond = minBond;
        if (durationLimit != 0) {
            uint256 durationPremium = Math.mulDiv(bond, duration, durationLimit);
            bond += durationPremium;
        }
        if (maxBond != 0 && bond > maxBond) bond = maxBond;
        if (bond > payout) bond = payout;
    }
}
