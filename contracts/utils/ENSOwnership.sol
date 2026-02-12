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
    uint256 private constant ENS_STATICCALL_GAS_LIMIT = 50_000;

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
        (bool ok, address owner) = _staticcallAddress(
            nameWrapperAddress,
            abi.encodeWithSelector(NameWrapperLike.ownerOf.selector, uint256(subnode))
        );
        if (!ok || owner == address(0)) return false;
        if (owner == claimant) return true;

        address approved;
        (ok, approved) = _staticcallAddress(
            nameWrapperAddress,
            abi.encodeWithSelector(bytes4(keccak256("getApproved(uint256)")), uint256(subnode))
        );
        if (ok && approved == claimant) return true;

        bool approvedForAll;
        (ok, approvedForAll) = _staticcallBool(
            nameWrapperAddress,
            abi.encodeWithSelector(bytes4(keccak256("isApprovedForAll(address,address)")), owner, claimant)
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
            abi.encodeWithSelector(ENSRegistryLike.resolver.selector, subnode)
        );
        if (!ok || resolverAddress == address(0)) return false;
        address resolvedAddress;
        (ok, resolvedAddress) = _staticcallAddress(
            resolverAddress,
            abi.encodeWithSelector(ResolverLike.addr.selector, subnode)
        );
        return ok && resolvedAddress == claimant;
    }

    function _staticcallAddress(address target, bytes memory payload) private view returns (bool ok, address result) {
        bytes memory data;
        (ok, data) = target.staticcall{ gas: ENS_STATICCALL_GAS_LIMIT }(payload);
        if (!ok || data.length != 32) return (false, address(0));
        result = abi.decode(data, (address));
    }

    function _staticcallBool(address target, bytes memory payload) private view returns (bool ok, bool result) {
        bytes memory data;
        (ok, data) = target.staticcall{ gas: ENS_STATICCALL_GAS_LIMIT }(payload);
        if (!ok || data.length != 32) return (false, false);
        uint256 value;
        assembly {
            value := mload(add(data, 0x20))
        }
        if (value > 1) return (false, false);
        result = value == 1;
    }
}
