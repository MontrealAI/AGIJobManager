// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../utils/EnsLabelUtils.sol";

contract EnsLabelUtilsHarness {
    function check(string memory label) external pure {
        EnsLabelUtils.requireValidLabel(label);
    }
}
