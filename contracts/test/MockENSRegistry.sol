// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENSRegistry {
    mapping(bytes32 => address) private owners;
    mapping(bytes32 => address) private resolvers;
    mapping(bytes32 => uint64) private ttls;

    function setOwner(bytes32 node, address owner) external {
        owners[node] = owner;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolvers[node];
    }

    function ttl(bytes32 node) external view returns (uint64) {
        return ttls[node];
    }

    function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttlValue) external {
        bytes32 child = keccak256(abi.encodePacked(node, label));
        owners[child] = owner;
        resolvers[child] = resolver;
        ttls[child] = ttlValue;
    }
}
