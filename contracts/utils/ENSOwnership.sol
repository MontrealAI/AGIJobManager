// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library ENSOwnership {
    uint256 private constant ENS_REGISTRY_GAS_LIMIT = 50_000;
    uint256 private constant ENS_RESOLVER_GAS_LIMIT = 50_000;
    uint256 private constant NAME_WRAPPER_GAS_LIMIT = 50_000;

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
            NAME_WRAPPER_GAS_LIMIT,
            0x6352211e,
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
            ENS_REGISTRY_GAS_LIMIT,
            0x0178b8bf,
            subnode
        );
        if (!ok || resolverAddress == address(0)) return false;
        address resolvedAddress;
        (ok, resolvedAddress) = _staticcallAddress(
            resolverAddress,
            ENS_RESOLVER_GAS_LIMIT,
            0x3b3b57de,
            subnode
        );
        return ok && resolvedAddress == claimant;
    }

    function _staticcallAddress(
        address target,
        uint256 gasLimit,
        bytes4 selector,
        bytes32 node
    ) private view returns (bool ok, address result) {
        bytes memory data;
        (ok, data) = target.staticcall{ gas: gasLimit }(abi.encodeWithSelector(selector, node));
        if (!ok || data.length != 32) return (false, address(0));
        assembly {
            result := shr(96, mload(add(data, 32)))
        }
    }
}
