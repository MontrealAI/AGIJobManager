// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library EnsLabelUtils {
    error InvalidENSLabel();

    function requireValidLabel(string memory label) internal pure {
        bytes memory b = bytes(label);
        uint256 len = b.length;
        if (len == 0 || len > 63) revert InvalidENSLabel();
        if (b[0] == "-" || b[len - 1] == "-") revert InvalidENSLabel();

        for (uint256 i = 0; i < len;) {
            bytes1 c = b[i];
            if (c == ".") revert InvalidENSLabel();

            bool isDigit = c >= "0" && c <= "9";
            bool isLower = c >= "a" && c <= "z";
            if (!(isDigit || isLower || c == "-")) revert InvalidENSLabel();

            unchecked {
                ++i;
            }
        }
    }
}
