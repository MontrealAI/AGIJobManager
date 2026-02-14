// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EnsLabelUtils.sol";

library ENSOwnership {
    uint256 private constant ENS_STATICCALL_GAS_LIMIT = 80_000;
    bytes4 private constant OWNER_OF_SELECTOR = 0x6352211e;
    bytes4 private constant GET_APPROVED_SELECTOR = 0x081812fc;
    bytes4 private constant IS_APPROVED_FOR_ALL_SELECTOR = 0xe985e9c5;
    bytes4 private constant RESOLVER_SELECTOR = 0x0178b8bf;
    bytes4 private constant ADDR_SELECTOR = 0x3b3b57de;

    function verifyENSOwnership(
        address ensAddress,
        address nameWrapperAddress,
        address claimant,
        string memory subdomain,
        bytes32 rootNode
    ) external view returns (bool) {
        EnsLabelUtils.requireValidLabel(subdomain);
        bytes32 subnode = keccak256(abi.encodePacked(rootNode, keccak256(bytes(subdomain))));
        if (_verifyNameWrapperOwnership(nameWrapperAddress, claimant, subnode)) {
            return true;
        }
        return _verifyResolverOwnership(ensAddress, claimant, subnode);
    }

    function _verifyNameWrapperOwnership(
        address nameWrapperAddress,
        address claimant,
        bytes32 subnode
    ) private view returns (bool) {
        if (nameWrapperAddress == address(0)) return false;
        (bool ok, address owner) = _staticcallAddress(
            nameWrapperAddress,
            abi.encodeWithSelector(OWNER_OF_SELECTOR, uint256(subnode))
        );
        if (!ok || owner == address(0)) return false;
        if (owner == claimant) return true;

        address approved;
        (ok, approved) = _staticcallAddress(
            nameWrapperAddress,
            abi.encodeWithSelector(GET_APPROVED_SELECTOR, uint256(subnode))
        );
        if (ok && approved == claimant) return true;

        bool approvedForAll;
        (ok, approvedForAll) = _staticcallBool(
            nameWrapperAddress,
            abi.encodeWithSelector(IS_APPROVED_FOR_ALL_SELECTOR, owner, claimant)
        );
        return ok && approvedForAll;
    }

    function _verifyResolverOwnership(
        address ensAddress,
        address claimant,
        bytes32 subnode
    ) private view returns (bool) {
        if (ensAddress == address(0)) return false;
        (bool ok, address resolverAddress) = _staticcallAddress(
            ensAddress,
            abi.encodeWithSelector(RESOLVER_SELECTOR, subnode)
        );
        if (!ok || resolverAddress == address(0)) return false;
        address resolvedAddress;
        (ok, resolvedAddress) = _staticcallAddress(
            resolverAddress,
            abi.encodeWithSelector(ADDR_SELECTOR, subnode)
        );
        return ok && resolvedAddress == claimant;
    }

    function _staticcallAddress(address target, bytes memory payload) private view returns (bool ok, address result) {
        uint256 decoded;
        (ok, decoded) = _staticcallWord(target, payload);
        if (!ok) return (false, address(0));
        result = address(uint160(decoded));
    }

    function _staticcallBool(address target, bytes memory payload) private view returns (bool ok, bool result) {
        uint256 decoded;
        (ok, decoded) = _staticcallWord(target, payload);
        if (!ok) return (false, false);
        if (decoded > 1) return (false, false);
        result = decoded == 1;
    }

    function _staticcallWord(address target, bytes memory payload) private view returns (bool ok, uint256 word) {
        assembly {
            ok := staticcall(ENS_STATICCALL_GAS_LIMIT, target, add(payload, 0x20), mload(payload), 0x00, 0x20)
            if lt(returndatasize(), 0x20) {
                ok := 0
            }
            if ok {
                returndatacopy(0x00, 0x00, 0x20)
                word := mload(0x00)
            }
        }
    }
}
