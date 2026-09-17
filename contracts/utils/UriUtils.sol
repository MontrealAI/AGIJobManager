// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library UriUtils {
    error InvalidParameters();
    uint256 internal constant ENS_URI_GAS_LIMIT = 200_000;
    uint256 internal constant ENS_URI_MAX_RETURN_BYTES = 2048;
    uint256 internal constant ENS_URI_MAX_STRING_BYTES = 1024;


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

    /// @notice Resolve a bounded ENS completion URI, falling back without blocking settlement.
    function completionURI(address target, uint256 jobId, string memory tokenUriValue, string memory baseIpfsUrl)
        external view returns (string memory)
    {
        if (target.code.length != 0) {
            bytes memory data;
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, shl(224, 0x751809b4))
                mstore(add(ptr, 4), jobId)

                if staticcall(ENS_URI_GAS_LIMIT, target, ptr, 0x24, 0, 0) {
                    let rdsize := returndatasize()
                    if gt(rdsize, ENS_URI_MAX_RETURN_BYTES) {
                        rdsize := ENS_URI_MAX_RETURN_BYTES
                    }

                    data := mload(0x40)
                    mstore(data, rdsize)
                    returndatacopy(add(data, 32), 0, rdsize)
                    mstore(0x40, add(add(data, 32), and(add(rdsize, 31), not(31))))
                }
            }
            if (data.length >= 64) {
                uint256 offset;
                uint256 strLen;
                assembly {
                    offset := mload(add(data, 32))
                    strLen := mload(add(data, 64))
                }
                if (offset == 32 && strLen > 0 && strLen <= ENS_URI_MAX_STRING_BYTES) {
                    uint256 paddedLen;
                    unchecked {
                        paddedLen = (strLen + 31) & ~uint256(31);
                    }
                    if (64 + paddedLen <= data.length) {
                        string memory ensUri;
                        assembly {
                            ensUri := add(data, 64)
                        }
                        tokenUriValue = ensUri;
                    }
                }
            }
        }
        return _applyBaseIpfs(tokenUriValue, baseIpfsUrl);
    }

    function applyBaseIpfs(string memory uri, string memory baseIpfsUrl) external pure returns (string memory) {
        return _applyBaseIpfs(uri, baseIpfsUrl);
    }

    function _applyBaseIpfs(string memory uri, string memory baseIpfsUrl) private pure returns (string memory) {
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
