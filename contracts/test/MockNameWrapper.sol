// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockNameWrapper {
    mapping(bytes32 => address) private nodeResolvers;
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
    bool public revertGetApproved;
    address public ensRegistry;
    uint256 public setResolverCalls;
    bytes32 public lastResolverNode;
    address public lastResolver;

    function setENSRegistry(address registry) external {
        ensRegistry = registry;
    }

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
        if (revertGetApproved) revert();
        return tokenApprovals[id];
    }

    function setRevertGetApproved(bool value) external {
        revertGetApproved = value;
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

    function setResolver(bytes32 node, address resolverAddr) external {
        setResolverCalls += 1;
        lastResolverNode = node;
        lastResolver = resolverAddr;
        nodeResolvers[node] = resolverAddr;
    }

    function resolver(bytes32 node) external view returns (address) {
        return nodeResolvers[node];
    }

    function setSubnodeOwner(bytes32 parentNode, string calldata label, address ownerAddr, uint32, uint64)
        external
        returns (bytes32)
    {
        bytes32 labelhash = keccak256(bytes(label));
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelhash));
        owners[uint256(subnode)] = ownerAddr;
        wrapped[subnode] = true;
        if (ensRegistry != address(0)) {
            (bool ok,) = ensRegistry.call(abi.encodeWithSignature("setOwner(bytes32,address)", subnode, address(this)));
            ok;
        }
        return subnode;
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
