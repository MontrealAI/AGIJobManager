// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library UriUtils {
    error InvalidParameters();

    bytes1 private constant SPACE = 0x20;
    bytes1 private constant TAB = 0x09;
    bytes1 private constant LF = 0x0a;
    bytes1 private constant CR = 0x0d;
    bytes1 private constant COLON = 0x3a;
    bytes1 private constant SLASH = 0x2f;

    function requireValidUri(string memory uri) external pure {
        bytes memory data = bytes(uri);
        if (data.length == 0) revert InvalidParameters();
        for (uint256 i = 0; i < data.length; ) {
            bytes1 c = data[i];
            if (c == SPACE || c == TAB || c == LF || c == CR) revert InvalidParameters();
            unchecked {
                ++i;
            }
        }
    }

    function applyBaseIpfs(string memory uri, string memory baseIpfsUrl) external pure returns (string memory) {
        bytes memory uriBytes = bytes(uri);
        bool hasScheme;
        for (uint256 i = 0; i + 2 < uriBytes.length; ) {
            if (uriBytes[i] == COLON && uriBytes[i + 1] == SLASH && uriBytes[i + 2] == SLASH) {
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
