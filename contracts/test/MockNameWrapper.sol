// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private approvals;
    mapping(bytes32 => bool) private wrapped;
    mapping(bytes32 => uint32) private fuses;
    mapping(bytes32 => address) private subnodeOwners;
    mapping(bytes32 => address) private subnodeResolvers;

    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return approvals[account][operator];
    }

    function setWrapped(bytes32 node, bool status) external {
        wrapped[node] = status;
    }

    function isWrapped(bytes32 node) external view returns (bool) {
        return wrapped[node];
    }

    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address owner,
        address resolver,
        uint64,
        uint32,
        uint64
    ) external returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        subnodeOwners[subnode] = owner;
        subnodeResolvers[subnode] = resolver;
        wrapped[subnode] = true;
        return subnode;
    }

    function setFuses(bytes32 node, uint32 newFuses) external returns (uint32) {
        fuses[node] = newFuses;
        return newFuses;
    }

    function subnodeOwner(bytes32 node) external view returns (address) {
        return subnodeOwners[node];
    }

    function subnodeResolver(bytes32 node) external view returns (address) {
        return subnodeResolvers[node];
    }

    function nodeFuses(bytes32 node) external view returns (uint32) {
        return fuses[node];
    }
}
