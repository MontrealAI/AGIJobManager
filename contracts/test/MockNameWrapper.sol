// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(uint256 => address) private owners;
    mapping(address => mapping(address => bool)) private approvals;

    struct SubnodeRecord {
        address owner;
        address resolver;
        uint64 ttl;
        uint32 fuses;
        uint64 expiry;
    }

    mapping(bytes32 => SubnodeRecord) private records;

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

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external {
        bytes32 node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        records[node] = SubnodeRecord({
            owner: owner,
            resolver: resolver,
            ttl: ttl,
            fuses: fuses,
            expiry: expiry
        });
    }

    function record(bytes32 node) external view returns (SubnodeRecord memory) {
        return records[node];
    }
}
