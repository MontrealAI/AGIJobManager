// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockResolver {
    mapping(bytes32 => address) private addresses;

    function setAddr(bytes32 node, address resolved) external {
        addresses[node] = resolved;
    }

    function addr(bytes32 node) external view returns (address payable) {
        return payable(addresses[node]);
    }
}
