// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private approvals;
    mapping(uint256 => address) private tokenApprovals;
    mapping(bytes32 => bool) private wrapped;
    mapping(bytes32 => uint32) private burnedFuses;
    uint256 public setChildFusesCalls;
    bytes32 public lastParentNode;
    bytes32 public lastLabelhash;
    uint32 public lastChildFuses;
    uint64 public lastChildExpiry;

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

    function setApproved(uint256 id, address approved) external {
        tokenApprovals[id] = approved;
    }

    function getApproved(uint256 id) external view returns (address) {
        return tokenApprovals[id];
    }

    function isWrapped(bytes32 node) external view returns (bool) {
        return wrapped[node];
    }

    function burnFuses(bytes32 node, uint32 fuses) external returns (uint32) {
        uint32 nextFuses = burnedFuses[node] | fuses;
        burnedFuses[node] = nextFuses;
        return nextFuses;
    }

    function setChildFuses(bytes32 parentNode, bytes32 labelhash, uint32 fuses, uint64 expiry) external {
        setChildFusesCalls += 1;
        lastParentNode = parentNode;
        lastLabelhash = labelhash;
        lastChildFuses = fuses;
        lastChildExpiry = expiry;
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
