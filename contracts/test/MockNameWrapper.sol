// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private approvals;
    mapping(bytes32 => bool) private wrapped;
    mapping(bytes32 => uint32) private fuses;

    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return approvals[owner][operator];
    }

    function isWrapped(bytes32 node) external view returns (bool) {
        return wrapped[node];
    }

    function setFuses(bytes32 node, uint32 newFuses) external returns (uint32) {
        fuses[node] = newFuses;
        return newFuses;
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address ownerAddr,
        address,
        uint64,
        uint32,
        uint64
    ) external returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        owners[uint256(subnode)] = ownerAddr;
        wrapped[subnode] = true;
        return subnode;
    }
}
