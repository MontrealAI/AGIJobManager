// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockENS {
    mapping(bytes32 => address) private resolvers;

    function setResolver(bytes32 ensNode, address resolverAddress) external {
        resolvers[ensNode] = resolverAddress;
    }

    function resolver(bytes32 ensNode) external view returns (address) {
        return resolvers[ensNode];
    }
}
