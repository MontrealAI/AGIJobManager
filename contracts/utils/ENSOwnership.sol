// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library ENSOwnership {
    uint256 private constant ENS_REGISTRY_GAS_LIMIT = 80_000;
    uint256 private constant ENS_RESOLVER_GAS_LIMIT = 80_000;
    uint256 private constant ENS_WRAPPER_GAS_LIMIT = 80_000;

    function verifyENSOwnership(
        address ensAddress,
        address nameWrapperAddress,
        address claimant,
        string memory subdomain,
        bytes32 rootNode
    ) external view returns (bool) {
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
        if (nameWrapperAddress == address(0) || nameWrapperAddress.code.length == 0) return false;
        (bool ok, address actualOwner) = _staticcallAddress(
            nameWrapperAddress,
            0x6352211e,
            subnode,
            ENS_WRAPPER_GAS_LIMIT
        );
        return ok && actualOwner == claimant;
    }

    function _verifyResolverOwnership(
        address ensAddress,
        address claimant,
        bytes32 subnode
    ) private view returns (bool) {
        if (ensAddress == address(0) || ensAddress.code.length == 0) return false;
        (bool ok, address resolverAddress) = _staticcallAddress(
            ensAddress,
            0x0178b8bf,
            subnode,
            ENS_REGISTRY_GAS_LIMIT
        );
        if (!ok || resolverAddress == address(0) || resolverAddress.code.length == 0) return false;

        address resolvedAddress;
        (ok, resolvedAddress) = _staticcallAddress(
            resolverAddress,
            0x3b3b57de,
            subnode,
            ENS_RESOLVER_GAS_LIMIT
        );
        return ok && resolvedAddress == claimant;
    }

    function _staticcallAddress(
        address target,
        bytes4 selector,
        bytes32 node,
        uint256 gasLimit
    ) private view returns (bool ok, address result) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, selector))
            mstore(add(ptr, 0x04), node)
            ok := staticcall(gasLimit, target, ptr, 0x24, ptr, 0x20)
            if and(ok, gt(returndatasize(), 0x1f)) {
                result := mload(ptr)
            }
            if iszero(and(ok, gt(returndatasize(), 0x1f))) {
                result := 0
                ok := 0
            }
        }
    }
}
