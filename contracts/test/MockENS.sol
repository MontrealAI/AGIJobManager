// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockENS {
    mapping(bytes32 => address) private resolvers;
    mapping(bytes32 => address) private owners;

    function setOwner(bytes32 node, address newOwner) external {
        owners[node] = newOwner;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function setResolver(bytes32 node, address resolverAddr) external {
        resolvers[node] = resolverAddr;
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolvers[node];
    }
}
