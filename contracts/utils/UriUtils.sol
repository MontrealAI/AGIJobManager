// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library UriUtils {
    error InvalidParameters();

    function requireValidUri(string memory uri) external pure {
        bytes memory data = bytes(uri);
        if (data.length == 0) revert InvalidParameters();
        for (uint256 i = 0; i < data.length; ) {
            bytes1 c = data[i];
            if (c == 0x20 || c == 0x09 || c == 0x0a || c == 0x0d) revert InvalidParameters();
            unchecked {
                ++i;
            }
        }
    }

    function applyBaseIpfs(string memory uri, string memory baseIpfsUrl) external pure returns (string memory) {
        bytes memory uriBytes = bytes(uri);
        bool hasScheme;
        for (uint256 i = 0; i + 2 < uriBytes.length; ) {
            if (uriBytes[i] == ":" && uriBytes[i + 1] == "/" && uriBytes[i + 2] == "/") {
                hasScheme = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
        if (!hasScheme && bytes(baseIpfsUrl).length != 0) {
            return string(abi.encodePacked(baseIpfsUrl, "/", uri));
        }
        return uri;
    }
}
