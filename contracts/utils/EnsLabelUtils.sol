// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library EnsLabelUtils {
    error InvalidENSLabel();

    bytes1 private constant DASH = 0x2d;
    bytes1 private constant DOT = 0x2e;
    bytes1 private constant ZERO = 0x30;
    bytes1 private constant NINE = 0x39;
    bytes1 private constant A = 0x61;
    bytes1 private constant Z = 0x7a;

    function requireValidLabel(string memory label) internal pure {
        bytes memory b = bytes(label);
        uint256 len = b.length;
        if (len == 0 || len > 63) revert InvalidENSLabel();
        if (b[0] == DASH || b[len - 1] == DASH) revert InvalidENSLabel();

        for (uint256 i = 0; i < len;) {
            bytes1 c = b[i];
            if (c == DOT) revert InvalidENSLabel();

            bool isDigit = c >= ZERO && c <= NINE;
            bool isLower = c >= A && c <= Z;
            if (!(isDigit || isLower || c == DASH)) revert InvalidENSLabel();

            unchecked {
                ++i;
            }
        }
    }
}
