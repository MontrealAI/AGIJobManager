// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private operatorApprovals;
    mapping(bytes32 => bool) private wrappedNodes;
    mapping(bytes32 => uint16) private nodeFuses;

    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }

    function setApprovalForAll(address operator, bool approved) external {
        operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return operatorApprovals[owner][operator];
    }

    function isWrapped(bytes32 node) external view returns (bool) {
        return wrappedNodes[node];
    }

    function setSubnodeRecord(
        bytes32 parent,
        bytes32 label,
        address owner,
        address,
        uint64,
        uint32,
        uint64
    ) external returns (bytes32 node) {
        node = keccak256(abi.encodePacked(parent, label));
        owners[uint256(node)] = owner;
        wrappedNodes[node] = true;
    }

    function setFuses(bytes32 node, uint16 ownerControlledFuses) external returns (uint32) {
        nodeFuses[node] = ownerControlledFuses;
        return ownerControlledFuses;
    }
}
