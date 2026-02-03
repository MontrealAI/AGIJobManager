// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockENS {
    mapping(bytes32 => address) private resolvers;

    function setResolver(bytes32 nodeHash, address resolverAddr) external {
        resolvers[nodeHash] = resolverAddr;
    }

    function resolver(bytes32 nodeHash) external view returns (address) {
        return resolvers[nodeHash];
    }
}
