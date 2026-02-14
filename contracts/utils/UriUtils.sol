// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library UriUtils {
    error InvalidParameters();

    bytes1 private constant COLON = 0x3a;
    bytes1 private constant SLASH = 0x2f;

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
        bytes memory baseBytes = bytes(baseIpfsUrl);
        if (_hasScheme(uriBytes) || baseBytes.length == 0) {
            return uri;
        }
        if (_startsWith(uriBytes, baseBytes)) {
            if (uriBytes.length == baseBytes.length) return uri;
            if (uriBytes[baseBytes.length] == SLASH) return uri;
        }

        bool baseEndsWithSlash = baseBytes[baseBytes.length - 1] == SLASH;
        bool uriStartsWithSlash = uriBytes.length > 0 && uriBytes[0] == SLASH;
        if (baseEndsWithSlash && uriStartsWithSlash) {
            return string(abi.encodePacked(baseIpfsUrl, _sliceFrom(uriBytes, 1)));
        }
        if (!baseEndsWithSlash && !uriStartsWithSlash) {
            return string(abi.encodePacked(baseIpfsUrl, "/", uri));
        }
        return string(abi.encodePacked(baseIpfsUrl, uri));
    }

    function _hasScheme(bytes memory uriBytes) private pure returns (bool) {
        for (uint256 i = 0; i + 2 < uriBytes.length; ) {
            if (uriBytes[i] == COLON && uriBytes[i + 1] == SLASH && uriBytes[i + 2] == SLASH) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _startsWith(bytes memory data, bytes memory prefix) private pure returns (bool) {
        if (data.length < prefix.length) return false;
        for (uint256 i = 0; i < prefix.length; ) {
            if (data[i] != prefix[i]) return false;
            unchecked {
                ++i;
            }
        }
        return true;
    }

    function _sliceFrom(bytes memory data, uint256 start) private pure returns (bytes memory out) {
        if (start >= data.length) return "";
        uint256 len = data.length - start;
        out = new bytes(len);
        for (uint256 i = 0; i < len; ) {
            out[i] = data[start + i];
            unchecked {
                ++i;
            }
        }
    }
}
