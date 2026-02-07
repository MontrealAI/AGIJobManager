// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENSRegistry {
    mapping(bytes32 => address) private owners;
    mapping(bytes32 => address) private resolvers;

    function setOwner(bytes32 node, address owner) external {
        owners[node] = owner;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolvers[node];
    }

    function setSubnodeRecord(bytes32 node, bytes32 label, address ownerAddr, address resolverAddr, uint64) external {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        owners[subnode] = ownerAddr;
        resolvers[subnode] = resolverAddr;
    }
}
