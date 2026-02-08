// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface INameWrapper {
    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function isWrapped(bytes32 node) external view returns (bool);
    function burnFuses(bytes32 node, uint32 fuses) external returns (uint32);
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32);
}
