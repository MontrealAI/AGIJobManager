// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ENSRegistryLike {
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}

interface ResolverLike {
    function addr(bytes32 node) external view returns (address payable);
}

interface NameWrapperLike {
    function ownerOf(uint256 id) external view returns (address);
}

library ENSOwnership {
    uint256 private constant ENS_STATICCALL_GAS_LIMIT = 200_000;

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
        if (nameWrapperAddress == address(0)) return false;
        (bool ok, address actualOwner) = _staticcallAddress(
            nameWrapperAddress,
            NameWrapperLike.ownerOf.selector,
            subnode
        );
        return ok && actualOwner == claimant;
    }

    function _verifyResolverOwnership(
        address ensAddress,
        address claimant,
        bytes32 subnode
    ) private view returns (bool) {
        if (ensAddress == address(0)) return false;
        (bool ok, address resolverAddress) = _staticcallAddress(
            ensAddress,
            ENSRegistryLike.resolver.selector,
            subnode
        );
        if (!ok) return false;
        if (resolverAddress == address(0)) return false;
        address resolvedAddress;
        (ok, resolvedAddress) = _staticcallAddress(
            resolverAddress,
            ResolverLike.addr.selector,
            subnode
        );
        return ok && resolvedAddress == claimant;
    }

    function _staticcallAddress(
        address target,
        bytes4 selector,
        bytes32 node
    ) private view returns (bool ok, address result) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, selector))
            mstore(add(ptr, 0x04), node)

            ok := staticcall(ENS_STATICCALL_GAS_LIMIT, target, ptr, 0x24, ptr, 0x20)
            if iszero(ok) {
                result := 0
            }
            if lt(returndatasize(), 0x20) {
                ok := 0
                result := 0
            }
            if ok {
                result := mload(ptr)
            }
        }
    }
}
