// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockENS {
    mapping(bytes32 => address) private resolvers;

    function setResolver(bytes32 node, address resolverAddress) external {
        resolvers[node] = resolverAddress;
    }

    function resolver(bytes32 node) external view returns (address) {
        return resolvers[node];
    }
}
