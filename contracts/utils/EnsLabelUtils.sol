// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library EnsLabelUtils {
    error InvalidENSLabel();

    function requireValidLabel(string memory label) internal pure {
        bytes memory b = bytes(label);
        uint256 len = b.length;
        if (len == 0 || len > 63) revert InvalidENSLabel();
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidENSLabel();

        for (uint256 i = 0; i < len;) {
            uint8 c = uint8(b[i]);
            if (c == 0x2e) revert InvalidENSLabel();
            if (c != 0x2d && (c < 0x30 || c > 0x39) && (c < 0x61 || c > 0x7a)) revert InvalidENSLabel();
            unchecked {
                ++i;
            }
        }
    }
}
