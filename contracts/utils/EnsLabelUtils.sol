// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library EnsLabelUtils {
    error InvalidENSLabel();

    function requireValidLabel(string memory label) internal pure {
        bytes memory b = bytes(label);
        uint256 length = b.length;
        if (length == 0 || length > 63) revert InvalidENSLabel();
        if (b[0] == bytes1("-") || b[length - 1] == bytes1("-")) revert InvalidENSLabel();

        for (uint256 i = 0; i < length;) {
            bytes1 c = b[i];
            if (!((c >= bytes1("0") && c <= bytes1("9")) || (c >= bytes1("a") && c <= bytes1("z")) || c == bytes1("-"))) {
                revert InvalidENSLabel();
            }
            unchecked {
                ++i;
            }
        }
    }
}
