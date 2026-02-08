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
        try NameWrapperLike(nameWrapperAddress).ownerOf(uint256(subnode)) returns (address actualOwner) {
            return actualOwner == claimant;
        } catch {
            return false;
        }
    }

    function _verifyResolverOwnership(
        address ensAddress,
        address claimant,
        bytes32 subnode
    ) private view returns (bool) {
        ENSRegistryLike registry = ENSRegistryLike(ensAddress);
        address resolverAddress = registry.resolver(subnode);
        if (resolverAddress == address(0)) return false;
        try ResolverLike(resolverAddress).addr(subnode) returns (address payable resolvedAddress) {
            return resolvedAddress == claimant;
        } catch {
            return false;
        }
    }
}
